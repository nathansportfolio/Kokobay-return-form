import clientPromise, { kokobayDbName } from "@/lib/mongodb";

/** Audit trail for `GET /api/product-stock` (theme / storefront callers). */
export const PRODUCT_STOCK_LOOKUPS_COLLECTION = "productStockLookups";

const CLIP_PAGE_URL = 2048;
const CLIP_ATTRIBUTION = 512;

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
  pageUrl?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;
};

function clip(s: string | null | undefined, max: number): string | null {
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
      userAgent: clip(input.userAgent, CLIP_ATTRIBUTION),
      referer: clip(input.referer, 1024),
      pageUrl: clip(input.pageUrl, CLIP_PAGE_URL),
      utmSource: clip(input.utmSource, CLIP_ATTRIBUTION),
      utmMedium: clip(input.utmMedium, CLIP_ATTRIBUTION),
      utmCampaign: clip(input.utmCampaign, CLIP_ATTRIBUTION),
      utmContent: clip(input.utmContent, CLIP_ATTRIBUTION),
      utmTerm: clip(input.utmTerm, CLIP_ATTRIBUTION),
      fbclid: clip(input.fbclid, CLIP_ATTRIBUTION),
      ttclid: clip(input.ttclid, CLIP_ATTRIBUTION),
    });
}
