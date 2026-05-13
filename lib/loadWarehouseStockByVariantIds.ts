import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { stockCollection, type StockDocument } from "@/lib/warehouseStockTypes";

export type WarehouseStockForVariant = {
  quantity: number;
  binCode: string;
};

/**
 * `stock` collection rows (same source as `POST /api/stock/line`): one document
 * per `variantId` with warehouse quantity and bin.
 */
export async function loadWarehouseStockByVariantIds(
  variantIds: number[],
): Promise<Map<number, WarehouseStockForVariant>> {
  const m = new Map<number, WarehouseStockForVariant>();
  const uniq = [
    ...new Set(
      variantIds.filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  if (uniq.length === 0) return m;
  try {
    const client = await clientPromise;
    const col = stockCollection(client.db(kokobayDbName));
    const docs = await col
      .find(
        { variantId: { $in: uniq } },
        { projection: { _id: 0, variantId: 1, quantity: 1, binCode: 1 } },
      )
      .toArray();
    for (const d of docs) {
      const row = d as StockDocument;
      const v = row.variantId;
      if (!Number.isFinite(v) || v < 1) continue;
      const quantity = Math.max(
        0,
        Math.trunc(Number(row.quantity) || 0),
      );
      const binCode = String(row.binCode ?? "").trim() || "—";
      m.set(v, { quantity, binCode });
    }
  } catch {
    /* Mongo optional; caller uses Shopify-only figures */
  }
  return m;
}
