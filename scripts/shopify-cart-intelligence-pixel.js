/* eslint-disable */
/**
 * Kokobay Cart Intelligence — Shopify Custom Pixel.
 *
 * HOW TO INSTALL
 * --------------
 * 1. Shopify admin → Settings → Customer events → Add custom pixel.
 * 2. Name it "Kokobay Cart Intelligence", permission = "Not required"
 *    (this pixel only sends first-party analytics to your own domain).
 * 3. Paste the WHOLE BODY of this file into the pixel code editor
 *    (Shopify Custom Pixels run in a sandboxed iframe — they do not have
 *    access to `window` so use `localStorage` cautiously; we use it only
 *    for the session id, with a `try/catch` so a Safari ITP fallback
 *    still works).
 * 4. Save → Connect.
 *
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * !! Update CART_INTELLIGENCE_ENDPOINT below if your production domain   !!
 * !! is not kokobay.com (e.g. staging environment, custom subdomain).    !!
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 *
 * Server route: app/api/cart-intelligence/event/route.ts
 * Storage:     lib/cartIntelligence.ts (Mongo collection
 *              `cart_intelligence_events`)
 *
 * Event sources used here are Shopify standard events:
 *   - product_added_to_cart
 *   - checkout_started
 *   - checkout_completed
 *
 * `analytics.subscribe(...)` runs inside Shopify's pixel runtime; the
 * `event` callback receives a `WebPixelsEvent` (see Shopify docs).
 */

// CHANGE ME if your production API domain is different.
var CART_INTELLIGENCE_ENDPOINT = "https://kokobay.com/api/cart-intelligence/event";

var SESSION_STORAGE_KEY = "kokobay_ci_session_id";
// Rotate the session id after this idle window so abandonment isn’t skewed
// by the same device returning days later. 30 days = Shopify’s default.
var SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Generate / read a stable per-browser session id. Shopify pixel sandboxes
 * sometimes block storage; we fall back to an in-memory id so events still
 * post in the same page-view.
 */
var inMemorySessionId = null;
var inMemorySessionExpires = 0;

function generateSessionId() {
  // crypto.randomUUID is available in modern browsers; fallback if not.
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return "ci_" + crypto.randomUUID();
    }
  } catch (e) {}
  return (
    "ci_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

function nowMs() {
  return new Date().getTime();
}

function readStoredSession() {
  try {
    if (typeof localStorage === "undefined") return null;
    var raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.id === "string" &&
      typeof parsed.expires === "number" &&
      parsed.expires > nowMs()
    ) {
      return parsed;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function writeStoredSession(id) {
  var record = { id: id, expires: nowMs() + SESSION_TTL_MS };
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(record));
    }
  } catch (e) {}
  inMemorySessionId = id;
  inMemorySessionExpires = record.expires;
  return record;
}

function getSessionId() {
  if (inMemorySessionId && inMemorySessionExpires > nowMs()) {
    return inMemorySessionId;
  }
  var stored = readStoredSession();
  if (stored) {
    inMemorySessionId = stored.id;
    inMemorySessionExpires = stored.expires;
    return stored.id;
  }
  var fresh = generateSessionId();
  writeStoredSession(fresh);
  return fresh;
}

/**
 * Stock-level helpers — must mirror lib/cartIntelligence.ts (server side
 * recomputes from `inventory_remaining` if it’s present, so this is just an
 * optimistic flag for clients without a numeric inventory hint).
 */
function deriveLowStock(inv) {
  return typeof inv === "number" && inv > 1 && inv < 7;
}
function deriveLastOne(inv) {
  return typeof inv === "number" && inv === 1;
}

function safeNumber(value) {
  if (value == null) return null;
  var n = Number(value);
  return isFinite(n) ? n : null;
}

function safeString(value) {
  if (value == null) return null;
  var s = String(value);
  return s.length > 0 ? s : null;
}

/**
 * Walk a Shopify pixel `cartLine` (or similar productVariant container) and
 * pick out the stock-relevant numbers. Different events expose this through
 * slightly different paths so we try several.
 */
function readInventoryRemaining(line) {
  if (!line) return null;
  var v = line.merchandise || line.variant || null;
  if (!v) return null;
  var candidates = [
    v.inventoryQuantity,
    v.inventory_quantity,
    v.product && v.product.inventoryQuantity,
    v.totalInventory,
    v.total_inventory,
  ];
  for (var i = 0; i < candidates.length; i++) {
    var n = safeNumber(candidates[i]);
    if (n != null) return n;
  }
  return null;
}

function readVariantId(line) {
  if (!line) return null;
  var v = line.merchandise || line.variant || null;
  if (!v) return null;
  return safeString(v.id || v.variantId || v.variant_id);
}

function readProductId(line) {
  if (!line) return null;
  var v = line.merchandise || line.variant || null;
  if (!v || !v.product) return null;
  return safeString(v.product.id || v.product.productId);
}

function readProductTitle(line) {
  if (!line) return null;
  var v = line.merchandise || line.variant || null;
  if (!v) return null;
  if (v.product && v.product.title) return safeString(v.product.title);
  return safeString(v.title);
}

function readVariantTitle(line) {
  if (!line) return null;
  var v = line.merchandise || line.variant || null;
  if (!v) return null;
  return safeString(v.title);
}

function readQuantity(line) {
  if (!line) return null;
  return safeNumber(line.quantity);
}

/**
 * The lowest stock level across all lines decides the cart bucket
 * (last_one beats low_stock beats normal). For checkout events we may have
 * multiple lines, so this picks the most "critical" one.
 */
function pickWorstLine(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  var lastOne = null;
  var low = null;
  var any = lines[0];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var inv = readInventoryRemaining(line);
    if (inv === 1 && !lastOne) lastOne = line;
    else if (inv != null && inv > 1 && inv < 7 && !low) low = line;
  }
  return lastOne || low || any;
}

function nowIso() {
  try {
    return new Date().toISOString();
  } catch (e) {
    return null;
  }
}

/**
 * Best-effort POST. We use `keepalive` and the `sendBeacon` fallback so the
 * event still flushes when the browser is unloading (e.g. navigating to the
 * checkout). Errors are intentionally swallowed — analytics must not break
 * the storefront.
 */
function sendEvent(payload) {
  try {
    if (!payload || !payload.event_name || !payload.session_id) return;
    var json = JSON.stringify(payload);

    // Prefer fetch() with `keepalive` so we can read the response when needed.
    if (typeof fetch === "function") {
      try {
        fetch(CART_INTELLIGENCE_ENDPOINT, {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: json,
        }).catch(function () {});
        return;
      } catch (e) {
        // Fall through to sendBeacon.
      }
    }
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        var blob = new Blob([json], { type: "application/json" });
        navigator.sendBeacon(CART_INTELLIGENCE_ENDPOINT, blob);
      } catch (e) {}
    }
  } catch (e) {}
}

/**
 * Build a payload for `product_added_to_cart` from the Shopify event.
 * Shopify event docs: data.cartLine (newly added line).
 */
function buildAddToCartPayload(event) {
  var data = (event && event.data) || {};
  var line = data.cartLine || data.line || null;
  var inv = readInventoryRemaining(line);
  return {
    event_name: "product_added_to_cart",
    session_id: getSessionId(),
    product_id: readProductId(line),
    variant_id: readVariantId(line),
    product_title: readProductTitle(line),
    variant_title: readVariantTitle(line),
    quantity: readQuantity(line),
    inventory_remaining: inv,
    low_stock: deriveLowStock(inv),
    last_one: deriveLastOne(inv),
    timestamp: nowIso(),
    source: "shopify_pixel",
  };
}

/**
 * Build a payload for checkout_started / checkout_completed. We tag the
 * event with the worst-stock line so the cart bucket reflects scarcity at
 * checkout time. Cart token / checkout token are forwarded for future
 * cross-event joining.
 */
function buildCheckoutPayload(eventName, event) {
  var data = (event && event.data) || {};
  var checkout = data.checkout || {};
  var lineItems = checkout.lineItems || checkout.line_items || [];
  var worst = pickWorstLine(lineItems);
  var inv = readInventoryRemaining(worst);
  var totalPrice = checkout.totalPrice || checkout.totalPriceSet || null;
  var amount = null;
  var currency = null;
  if (totalPrice) {
    amount = safeNumber(totalPrice.amount || (totalPrice.shopMoney && totalPrice.shopMoney.amount));
    currency = safeString(
      totalPrice.currencyCode || (totalPrice.shopMoney && totalPrice.shopMoney.currencyCode),
    );
  }
  return {
    event_name: eventName,
    session_id: getSessionId(),
    cart_token: safeString(checkout.token || checkout.cartToken),
    checkout_token: safeString(checkout.token),
    product_id: readProductId(worst),
    variant_id: readVariantId(worst),
    product_title: readProductTitle(worst),
    variant_title: readVariantTitle(worst),
    quantity: readQuantity(worst),
    inventory_remaining: inv,
    low_stock: deriveLowStock(inv),
    last_one: deriveLastOne(inv),
    cart_value: amount,
    currency: currency,
    timestamp: nowIso(),
    source: "shopify_pixel",
  };
}

/**
 * Subscribe inside a `try/catch` because the pixel runtime exposes
 * `analytics.subscribe`; if the runtime ever changes shape we don’t want
 * the entire pixel to throw on init.
 */
try {
  analytics.subscribe("product_added_to_cart", function (event) {
    sendEvent(buildAddToCartPayload(event));
  });
  analytics.subscribe("checkout_started", function (event) {
    sendEvent(buildCheckoutPayload("checkout_started", event));
  });
  analytics.subscribe("checkout_completed", function (event) {
    sendEvent(buildCheckoutPayload("checkout_completed", event));
  });
} catch (err) {
  // No-op: analytics may not be defined outside the pixel sandbox.
}
