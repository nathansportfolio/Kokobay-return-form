import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { stockCollection } from "@/lib/warehouseStockTypes";

export type StockAtLocation = {
  sku: string;
  quantity: number;
  productId: number;
  variantId: number;
};

/** Stock rows indexed by `binCode` (e.g. `A-04-C`) for the layout page. */
export async function getStockByBinCode(): Promise<
  Record<string, StockAtLocation[]>
> {
  const client = await clientPromise;
  const col = stockCollection(client.db(kokobayDbName));
  const docs = await col
    .find(
      {},
      {
        projection: {
          _id: 0,
          binCode: 1,
          sku: 1,
          quantity: 1,
          productId: 1,
          variantId: 1,
        },
      },
    )
    .toArray();

  const out: Record<string, StockAtLocation[]> = {};
  for (const d of docs) {
    const code = String((d as { binCode?: string }).binCode ?? "").trim();
    if (!code) continue;
    const productId = Number((d as { productId?: number }).productId);
    const variantId = Number((d as { variantId?: number }).variantId);
    if (!Number.isFinite(productId) || !Number.isFinite(variantId)) continue;
    const sku = String((d as { sku?: string }).sku ?? "").trim() || "—";
    const quantity = Math.max(
      0,
      Math.trunc(Number((d as { quantity?: number }).quantity) || 0),
    );
    if (!out[code]) out[code] = [];
    out[code]!.push({ sku, quantity, productId, variantId });
  }
  for (const k of Object.keys(out)) {
    out[k]!.sort((a, b) => a.sku.localeCompare(b.sku));
  }
  return out;
}
