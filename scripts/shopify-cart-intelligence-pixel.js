/* eslint-disable */
/**
 * Kokobay Cart Intelligence — Shopify Custom Pixel.
 *
 * HOW TO INSTALL
 * --------------
 * 1. Shopify admin → Settings → Customer events → Add custom pixel.
 * 2. Name it "Kokobay Cart Intelligence", permission = "Not required"
 *    (this pixel only sends first-party analytics to your own domain).
 * 3. Paste the WHOLE BODY of this file into the pixel code editor.
 * 4. Save → Connect.
 *
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * !! Update CART_INTELLIGENCE_ENDPOINT below if your production domain   !!
 * !! is not kokobay.com (e.g. staging environment, custom subdomain).    !!
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 *
 * The pixel is intentionally dumb:
 *   - It identifies the variant via its Storefront `id` (a GID).
 *   - It does NOT compute `inventory_remaining`, `low_stock`, or `last_one`.
 *
 * The server-side route (`app/api/cart-intelligence/event/route.ts`) calls
 * Shopify Admin REST to fetch the variant’s live `inventory_quantity`,
 * recomputes the flags, and writes the enriched event to MongoDB. That way
 * the bucketing rules can change in one place without touching the pixel.
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

/* ------------------------------------------------------------------------ *
 * Shopify Web Pixel payloads can shape variant info under a few different
 * paths depending on the event. These helpers normalise that.
 * ------------------------------------------------------------------------ */

function readVariant(line) {
  if (!line) return null;
  return line.merchandise || line.variant || null;
}

function readVariantId(line) {
  var v = readVariant(line);
  if (!v) return null;
  // GID strings (`gid://shopify/ProductVariant/12345`) — server understands both.
  return safeString(v.id || v.variantId || v.variant_id);
}

function readProductId(line) {
  var v = readVariant(line);
  if (!v || !v.product) return null;
  return safeString(v.product.id || v.product.productId);
}

function readProductTitle(line) {
  var v = readVariant(line);
  if (!v) return null;
  if (v.product && v.product.title) return safeString(v.product.title);
  return safeString(v.title);
}

function readVariantTitle(line) {
  var v = readVariant(line);
  if (!v) return null;
  return safeString(v.title);
}

function readQuantity(line) {
  if (!line) return null;
  return safeNumber(line.quantity);
}

/**
 * Pick the “most interesting” line at checkout: stock-level decisions belong
 * to the server, but we still need to point it at *some* variant id so it
 * can fetch inventory. We prefer the first line with a numeric variant id,
 * else fall back to the first line.
 */
function pickPrimaryLine(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  for (var i = 0; i < lines.length; i++) {
    if (readVariantId(lines[i])) return lines[i];
  }
  return lines[0];
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
      } catch (e) {}
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
 * Build a payload for `product_added_to_cart`. We deliberately do NOT send
 * `inventory_remaining`, `low_stock`, or `last_one`; the server fetches the
 * variant from Shopify Admin and computes those.
 */
function buildAddToCartPayload(event) {
  var data = (event && event.data) || {};
  var line = data.cartLine || data.line || null;
  return {
    event_name: "product_added_to_cart",
    session_id: getSessionId(),
    product_id: readProductId(line),
    variant_id: readVariantId(line),
    product_title: readProductTitle(line),
    variant_title: readVariantTitle(line),
    quantity: readQuantity(line),
    timestamp: nowIso(),
    source: "shopify_pixel",
  };
}

function buildCheckoutPayload(eventName, event) {
  var data = (event && event.data) || {};
  var checkout = data.checkout || {};
  var lineItems = checkout.lineItems || checkout.line_items || [];
  var primary = pickPrimaryLine(lineItems);
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
    product_id: readProductId(primary),
    variant_id: readVariantId(primary),
    product_title: readProductTitle(primary),
    variant_title: readVariantTitle(primary),
    quantity: readQuantity(primary),
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
