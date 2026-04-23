/**
 * Matches `toWarehouseLines` in `lib/shopifyWarehouseDayOrders.ts` when Shopify
 * has no SKU: `V` + `variant_id`. UIs can hide that placeholder; real SKUs that
 * match this pattern are indistinguishable here.
 * Also: bad/missing `variant_id` can stringify as `Vnull` / `Vundefined` (not `V` + digits).
 */
const VARIANT_ID_PLACEHOLDER_SKU = /^V\d+$/u;
const PLACEHOLDER_SKU_BAD_V_SUFFIX = /^V(nul|undefined|NaN|null)$/iu;

export function isVariantIdPlaceholderSku(sku: string): boolean {
  const s = String(sku ?? "").trim();
  if (VARIANT_ID_PLACEHOLDER_SKU.test(s)) return true;
  if (PLACEHOLDER_SKU_BAD_V_SUFFIX.test(s)) return true;
  if (s === "V" || s === "v") return true;
  return false;
}
