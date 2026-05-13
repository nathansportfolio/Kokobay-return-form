import clientPromise, { kokobayDbName } from "@/lib/mongodb";

/** Audit trail for `GET /api/product-stock` (theme / storefront callers). */
export const PRODUCT_STOCK_LOOKUPS_COLLECTION = "productStockLookups";

export type ProductStockLookupVariantLog = {
  id?: number;
  title: string;
  inventory: number | null;
  inventorySource: "warehouse" | "shopify";
  binCode: string | null;
};

export type ProductStockLookupLogInput = {
  handle: string;
  shopifyProductId: number;
  productTitle: string;
  variants: ProductStockLookupVariantLog[];
  userAgent: string | null;
  referer: string | null;
};

function clip(s: string | null, max: number): string | null {
  if (s == null) return null;
  const t = s.trim();
  if (!t) return null;
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export async function insertProductStockLookupLog(
  input: ProductStockLookupLogInput,
): Promise<void> {
  const client = await clientPromise;
  await client
    .db(kokobayDbName)
    .collection(PRODUCT_STOCK_LOOKUPS_COLLECTION)
    .insertOne({
      createdAt: new Date(),
      handle: input.handle,
      shopifyProductId: input.shopifyProductId,
      productTitle: input.productTitle,
      variants: input.variants,
      userAgent: clip(input.userAgent, 512),
      referer: clip(input.referer, 1024),
    });
}
