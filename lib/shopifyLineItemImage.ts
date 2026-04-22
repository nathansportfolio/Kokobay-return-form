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
 */
function imageUrlForLine(
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
 * Fetches only the `ShopifyProduct` data needed to resolve per-variant images.
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
      `products.json?ids=${q}&fields=id,image,images,variants&limit=250`,
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
      imageUrlForLine(p, li.variant_id).trim(),
    );
  }
  return byLineId;
}
