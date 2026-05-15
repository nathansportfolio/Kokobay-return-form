import { shopifyAdminGetNoCache } from "@/lib/shopifyAdminApi";
import type {
  ShopifyImage,
  ShopifyLineItem,
  ShopifyProduct,
  ShopifyProductsResponse,
  ShopifyVariant,
} from "@/types/shopify";

/**
 * Picks the best product image for a line: variant’s image, image that lists
 * this `variant_id`, or product default / first image.
 *
 * Exported for product CSV/JSON exports — variant `image_id` is often null
 * when the store only set a **product**-level featured image.
 */
export function shopifyVariantImageUrl(
  product: ShopifyProduct,
  variantId: number,
): string {
  const v = findVariant(product.variants, variantId);
  if (v?.image_id) {
    const fromId = findImageById(product.images, v.image_id);
    if (fromId?.src) return fromId.src.trim();
  }
  const forVariant = (product.images ?? []).find(
    (i) => Array.isArray(i.variant_ids) && i.variant_ids.includes(variantId),
  );
  if (forVariant?.src) return forVariant.src.trim();
  if (product.image?.src) return product.image.src.trim();
  return product.images?.[0]?.src?.trim() ?? "";
}

function findVariant(
  variants: ShopifyVariant[] | undefined,
  variantId: number,
) {
  return (variants ?? []).find((v) => v.id === variantId);
}

function findImageById(images: ShopifyImage[] | undefined, id: number) {
  return (images ?? []).find((i) => i.id === id);
}

const ID_CHUNK = 100;

/**
 * Fetches `ShopifyProduct` data for per-variant images and **SKU** (order lines
 * often omit merchant SKU but carry `KOKO-VAR-{id}`; live product variants carry
 * the real value).
 *
 * We avoid `fields=…` so Admin returns full `variants` objects (including `sku`);
 * narrow responses previously dropped variant SKU in some cases.
 */
export async function fetchShopifyProductsForLineItemImages(
  productIds: number[],
): Promise<Map<number, ShopifyProduct>> {
  const m = new Map<number, ShopifyProduct>();
  const ids = [...new Set(productIds.filter((id) => id > 0))];
  if (ids.length === 0) return m;

  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const part = ids.slice(i, i + ID_CHUNK);
    const q = part.map(String).join(",");
    const r = await shopifyAdminGetNoCache<ShopifyProductsResponse>(
      `products.json?ids=${q}&limit=250`,
    );
    if (r.ok && r.data.products) {
      for (const p of r.data.products) {
        m.set(p.id, p);
      }
    }
  }
  return m;
}

/**
 * `imageUrl` for each line: Shopify CDN when available.
 */
export function lineItemImageUrlsFromProductMap(
  lineItems: Pick<ShopifyLineItem, "id" | "product_id" | "variant_id">[],
  byProductId: Map<number, ShopifyProduct>,
): Map<string, string> {
  const byLineId = new Map<string, string>();
  for (const li of lineItems) {
    const p = byProductId.get(li.product_id);
    const key = String(li.id);
    if (!p) {
      byLineId.set(key, "");
      continue;
    }
    byLineId.set(
      key,
      shopifyVariantImageUrl(p, li.variant_id).trim(),
    );
  }
  return byLineId;
}
