const DEFAULT_SHOPIFY_STORE = "koko-bay";

function storeHandle(): string {
  return process.env.NEXT_PUBLIC_SHOPIFY_STORE_HANDLE?.trim() || DEFAULT_SHOPIFY_STORE;
}

/**
 * Path shape (example):
 * `https://admin.shopify.com/store/koko-bay/orders/12985108038018`
 * The last segment is Shopify’s **resource id** (Admin / REST `order.id`), not the
 * order name or `order_number`.
 */
function buildAdminOrderUrl(shopifyOrderId: string): string {
  const id = String(shopifyOrderId).trim();
  return `https://admin.shopify.com/store/${storeHandle()}/orders/${encodeURIComponent(id)}`;
}

/**
 * e.g. `https://admin.shopify.com/store/koko-bay/products/14974895686018/variants/55166849253762`
 * Uses `NEXT_PUBLIC_SHOPIFY_STORE_HANDLE` (same as order admin links).
 */
export function shopifyProductVariantAdminUrl(
  productId: number | string,
  variantId: number | string,
): string {
  const p = String(productId).trim();
  const v = String(variantId).trim();
  return `https://admin.shopify.com/store/${storeHandle()}/products/${encodeURIComponent(
    p,
  )}/variants/${encodeURIComponent(v)}`;
}

/**
 * Use when you have the real Shopify order id (from API `order.id`). Prefer
 * `shopifyOrderId` string on app `Order` to avoid large-integer precision issues.
 */
export function shopifyOrderAdminUrlByOrderId(
  orderId: number | string,
): string {
  return buildAdminOrderUrl(String(orderId));
}

/**
 * Map warehouse / customer order ref to the numeric id used in admin URLs.
 * Set `NEXT_PUBLIC_SHOPIFY_ORDER_ADMIN_ID_MAP` to JSON e.g. `{"333344":"12985108038018"}`.
 */
export function resolveShopifyAdminOrderId(orderLabel: string): string {
  const key = orderLabel.trim();
  const raw = process.env.NEXT_PUBLIC_SHOPIFY_ORDER_ADMIN_ID_MAP;
  if (raw) {
    try {
      const map = JSON.parse(raw) as Record<string, string>;
      if (map && typeof map === "object") {
        return map[key] ?? map[key.toUpperCase()] ?? key;
      }
    } catch {
      /* */
    }
  }
  return key;
}

/**
 * When you only have a customer or logged `orderRef` (not the REST id).
 * If the ref is already a long numeric id (typical admin id length), it is used as-is;
 * otherwise the env map (or the ref) is used.
 */
export function shopifyOrderAdminUrlFromOrderRef(orderRef: string): string {
  const t = orderRef.trim();
  if (/^\d{10,}$/.test(t)) {
    return buildAdminOrderUrl(t);
  }
  return buildAdminOrderUrl(resolveShopifyAdminOrderId(t));
}

/** @alias {@link shopifyOrderAdminUrlFromOrderRef} */
export function shopifyOrderAdminUrl(orderRef: string): string {
  return shopifyOrderAdminUrlFromOrderRef(orderRef);
}
