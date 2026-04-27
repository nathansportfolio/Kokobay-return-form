import type { ShopifyLineItem, ShopifyVariant } from "@/types/shopify";

/**
 * Single source of truth for how a Shopify **variant** (or order line) maps
 * to the warehouse string we use as `sku` everywhere: merchant value when set,
 * else `KOKO-VAR-{variantId}` (same as `shopify_product_catalog` keys).
 *
 * Safe to import from **client** components (no Mongo/Node-only deps).
 */
export const SHOPIFY_SYNTHETIC_SKU_PREFIX = "KOKO-VAR-" as const;

export function catalogSkuForVariant(
  v: Pick<ShopifyVariant, "id" | "sku">,
): { sku: string; shopifySku: string | null } {
  if (typeof v.id !== "number" || !Number.isFinite(v.id)) {
    return { sku: `${SHOPIFY_SYNTHETIC_SKU_PREFIX}0`, shopifySku: null };
  }
  const raw = String(v.sku ?? "").trim();
  if (raw) {
    return { sku: raw, shopifySku: raw };
  }
  return {
    sku: `${SHOPIFY_SYNTHETIC_SKU_PREFIX}${v.id}`,
    shopifySku: null,
  };
}

/**
 * Order line from Shopify Admin / Storefront (uses `variant_id` not `id` on variant).
 */
export function catalogSkuForShopifyLineItem(
  li: Pick<ShopifyLineItem, "variant_id" | "sku">,
): string {
  const id = li.variant_id;
  if (typeof id === "number" && Number.isFinite(id)) {
    return catalogSkuForVariant({ id, sku: li.sku }).sku;
  }
  return catalogSkuForVariant({ id: 0, sku: li.sku }).sku;
}
