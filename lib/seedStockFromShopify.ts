import type { MongoClient } from "mongodb";
import { fetchAllShopifyProducts } from "@/lib/fetchAllShopifyProducts";
import { kokobayDbName } from "@/lib/mongodb";
import {
  type StockDocument,
  stockCollection,
  STOCK_COLLECTION,
} from "@/lib/warehouseStockTypes";
import type { ShopifyProduct, ShopifyVariant } from "@/types/shopify";

const BINS_COLLECTION = "bins";

function pickRandomBin(binCodes: string[]): string {
  return binCodes[Math.floor(Math.random() * binCodes.length)]!;
}

function randomQuantity(): number {
  return 1 + Math.floor(Math.random() * 20);
}

function variantSku(
  v: Pick<ShopifyVariant, "id" | "sku" | "title">,
): string {
  const s = v.sku?.trim();
  if (s) {
    return s;
  }
  return `V${v.id}`;
}

type SeedResult =
  | {
      ok: true;
      database: string;
      collection: string;
      inserted: number;
      variantCount: number;
      binCodeCount: number;
      distinctBinsWithStock: number;
    }
  | { ok: false; error: string };

/**
 * Replaces all `stock` documents: loads every product variant from Shopify, assigns
 * each to a random bin, sets `isOccupied` on `bins` from which bins hold stock.
 * The `bins` collection must be populated first (e.g. POST /api/bins).
 */
export async function seedStockFromShopify(
  client: MongoClient,
): Promise<SeedResult> {
  const db = client.db(kokobayDbName);
  const bins = db.collection<{ code: string; isOccupied: boolean }>(
    BINS_COLLECTION,
  );
  const codeDocs = await bins
    .find({})
    .project({ code: 1, _id: 0 })
    .toArray();
  const binCodes = codeDocs
    .map((d) => String((d as { code?: string }).code ?? ""))
    .filter((c) => c.length > 0);
  if (binCodes.length === 0) {
    return {
      ok: false,
      error:
        "No bins in the database. Run `POST /api/bins` first, then try again.",
    };
  }

  const shop = await fetchAllShopifyProducts();
  if (!shop.ok) {
    return { ok: false, error: shop.error };
  }
  if (shop.products.length === 0) {
    return { ok: false, error: "No products returned from Shopify" };
  }

  const now = new Date();
  const stockRows: StockDocument[] = [];
  for (const p of shop.products) {
    for (const v of p.variants ?? []) {
      if (!Number.isFinite(v.id) || !Number.isFinite(p.id)) {
        continue;
      }
      const binCode = pickRandomBin(binCodes);
      stockRows.push({
        binCode,
        productId: p.id,
        variantId: v.id,
        sku: variantSku(v),
        quantity: randomQuantity(),
        updatedAt: now,
      });
    }
  }

  if (stockRows.length === 0) {
    return { ok: false, error: "No variants to place in bins" };
  }

  const coll = stockCollection(db);
  await coll.deleteMany({});
  await coll.createIndex({ binCode: 1 });
  await coll.createIndex({ variantId: 1 }, { unique: true });
  const ins = await coll.insertMany(stockRows, { ordered: false });
  const inserted = ins.insertedCount;

  const withStock = new Set(stockRows.map((s) => s.binCode));
  await bins.updateMany({}, { $set: { isOccupied: false } });
  await bins.updateMany(
    { code: { $in: [...withStock] } },
    { $set: { isOccupied: true } },
  );

  return {
    ok: true,
    database: kokobayDbName,
    collection: STOCK_COLLECTION,
    inserted,
    variantCount: stockRows.length,
    binCodeCount: binCodes.length,
    distinctBinsWithStock: withStock.size,
  };
}
