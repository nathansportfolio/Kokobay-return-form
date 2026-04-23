import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { STOCK_COLLECTION, type StockDocument } from "@/lib/warehouseStockTypes";

/**
 * `stock` rows: one row per `variantId` (unique). Maps Shopify variant id →
 * `binCode` (e.g. `A-01-A`) for pick-list placement.
 */
export async function loadBinCodeByVariantId(
  variantIds: number[],
): Promise<Map<number, string>> {
  const m = new Map<number, string>();
  const uniq = [...new Set(variantIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (uniq.length === 0) return m;
  try {
    const client = await clientPromise;
    const col = client
      .db(kokobayDbName)
      .collection<StockDocument>(STOCK_COLLECTION);
    const docs = await col
      .find(
        { variantId: { $in: uniq } },
        { projection: { variantId: 1, binCode: 1, _id: 0 } },
      )
      .toArray();
    for (const d of docs) {
      const v = d.variantId;
      const c = String(d.binCode ?? "").trim();
      if (Number.isFinite(v) && c) {
        m.set(v, c);
      }
    }
  } catch {
    /* Mongo optional; caller falls back to mock locations */
  }
  return m;
}
