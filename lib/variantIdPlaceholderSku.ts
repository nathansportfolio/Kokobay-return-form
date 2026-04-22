/**
 * Matches `toWarehouseLines` in `lib/shopifyWarehouseDayOrders.ts` when Shopify
 * has no SKU: `V` + `variant_id`. UIs can hide that placeholder; real SKUs that
 * match this pattern are indistinguishable here.
 */
const VARIANT_ID_PLACEHOLDER_SKU = /^V\d+$/u;

export function isVariantIdPlaceholderSku(sku: string): boolean {
  return VARIANT_ID_PLACEHOLDER_SKU.test(sku);
}
