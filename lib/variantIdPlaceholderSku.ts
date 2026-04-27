/**
 * Legacy **synthetic** placeholder: `V` + digits only. New code uses
 * `KOKO-VAR-{variantId}` (see `shopifyCanonicalVariantSku`) — that is a real
 * internal key, not a “hide me” placeholder.
 *
 * UIs can hide `V{…}`; real SKUs that match this pattern are indistinguishable
 * from legacy placeholders. Bad/missing `variant_id` could yield `Vnull` etc.
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
