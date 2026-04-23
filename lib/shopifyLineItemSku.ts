import { deriveKokobayStyleSkuFromTitle } from "@/lib/deriveKokobayStyleSkuFromTitle";
import { lineItemTitle } from "@/lib/shopifyLineItemTitle";
import type { ShopifyLineItem } from "@/types/shopify";

/**
 * Merchant SKU if set; else a compact generated code from the line title
 * (`COWL-BLPU-4`); if that is not possible, `V` + `variant_id` (legacy).
 */
export function displaySkuForShopifyLineItem(
  li: Pick<
    ShopifyLineItem,
    "id" | "variant_id" | "sku" | "title" | "variant_title"
  >,
): string {
  const s = li.sku?.trim();
  if (s) return s;
  const t = lineItemTitle(li);
  return deriveKokobayStyleSkuFromTitle(t) ?? `V${li.variant_id}`;
}
