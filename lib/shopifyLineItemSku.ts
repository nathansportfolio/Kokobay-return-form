import {
  catalogSkuForShopifyLineItem,
  catalogSkuForVariant,
} from "@/lib/shopifyCanonicalVariantSku";
import type { ShopifyLineItem, ShopifyProduct } from "@/types/shopify";

/**
 * Warehouse `sku` string for a line item — same rules as
 * {@link catalogSkuForVariant} / the product catalog.
 *
 * **Order line items** often carry Shopify’s synthetic `KOKO-VAR-{variantId}` in
 * `sku` even when the **live product variant** has a merchant SKU in Admin. When
 * `product` is provided, we prefer the variant’s merchant `sku` from the product
 * payload when present, then fall back to the order line.
 *
 * Pass `product` when you already loaded `GET products.json?ids=…` for that
 * line’s `product_id` (e.g. returns preview / order lines with images).
 */
export function displaySkuForShopifyLineItem(
  li: Pick<
    ShopifyLineItem,
    "id" | "product_id" | "variant_id" | "sku" | "title" | "variant_title"
  >,
  product?: ShopifyProduct | null,
): string {
  const vid = li.variant_id;
  const v =
    product?.variants?.length && typeof vid === "number" && Number.isFinite(vid)
      ? product.variants.find((x) => Number(x.id) === Number(vid))
      : undefined;

  const variantMerchantSku = v ? String(v.sku ?? "").trim() : "";
  if (variantMerchantSku && v) {
    const idNum = Number(v.id);
    if (Number.isFinite(idNum)) {
      return catalogSkuForVariant({ id: idNum, sku: v.sku }).sku;
    }
  }

  const lineSkuTrim = String(li.sku ?? "").trim();
  if (lineSkuTrim) {
    return catalogSkuForShopifyLineItem(li);
  }

  if (v) {
    const idNum = Number(v.id);
    if (Number.isFinite(idNum)) {
      return catalogSkuForVariant({ id: idNum, sku: v.sku }).sku;
    }
  }

  return catalogSkuForShopifyLineItem(li);
}
