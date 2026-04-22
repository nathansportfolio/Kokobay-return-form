const DEFAULT_SHOPIFY_STORE = "koko-bay";

/**
 * Numeric order id in Shopify admin URLs, when it differs from the
 * `/returns/:orderLabel` key. Set e.g. `{"2122":"12983974494594"}` in
 * `NEXT_PUBLIC_SHOPIFY_ORDER_ADMIN_ID_MAP` (JSON object).
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
      /* use key as id */
    }
  }
  return key;
}

/** `https://admin.shopify.com/store/koko-bay/orders/…` (customisable via env). */
export function shopifyOrderAdminUrl(orderLabel: string): string {
  const id = resolveShopifyAdminOrderId(orderLabel);
  const store =
    process.env.NEXT_PUBLIC_SHOPIFY_STORE_HANDLE?.trim() ||
    DEFAULT_SHOPIFY_STORE;
  return `https://admin.shopify.com/store/${store}/orders/${encodeURIComponent(id)}`;
}
