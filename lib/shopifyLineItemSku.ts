import { catalogSkuForShopifyLineItem } from "@/lib/shopifyCanonicalVariantSku";
import type { ShopifyLineItem } from "@/types/shopify";

/**
 * Warehouse `sku` string for a line item — same rules as
 * {@link catalogSkuForVariant} / the product catalog: merchant `line_item.sku`
 * when set, else `KOKO-VAR-{variant_id}`. No title-based codes (they collided
 * for e.g. tops vs bottoms in the same style).
 *
 * If `variant_id` is missing and there is no merchant sku, returns
 * `KOKO-VAR-0` (or adjust upstream data).
 */
export function displaySkuForShopifyLineItem(
  li: Pick<
    ShopifyLineItem,
    "id" | "variant_id" | "sku" | "title" | "variant_title"
  >,
): string {
  return catalogSkuForShopifyLineItem(li);
}
