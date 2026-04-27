import type { MongoClient } from "mongodb";
import { ensureStockCollectionIndexes } from "@/lib/ensureStockCollectionIndexes";
import { fetchAllShopifyProducts } from "@/lib/fetchAllShopifyProducts";
import { kokobayDbName } from "@/lib/mongodb";
import {
  type StockDocument,
  stockCollection,
  STOCK_COLLECTION,
} from "@/lib/warehouseStockTypes";
import { catalogSkuForVariant } from "@/lib/shopifyCanonicalVariantSku";
import type { ShopifyProduct, ShopifyVariant } from "@/types/shopify";

const BINS_COLLECTION = "bins";

/** Random permutation — each bin used at most once. */
function shuffleInPlace<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i]!, a[j]!] = [a[j]!, a[i]!];
  }
  return a;
}

function randomQuantity(): number {
  return 1 + Math.floor(Math.random() * 20);
}

type SeedResult =
  | {
      ok: true;
      database: string;
      collection: string;
      inserted: number;
      variantCount: number;
      binCodeCount: number;
      /** Bins that received a variant (same as `inserted` with unique bin assignment). */
      distinctBinsWithStock: number;
      /** Variants with no row because every bin was already used. */
      variantsSkippedNoEmptyBin: number;
    }
  | { ok: false; error: string };

/**
 * Replaces all `stock` documents: loads every product variant from Shopify, assigns
 * each variant to a **distinct** bin (at most one SKU per `binCode`), random
 * quantity 1–20, and sets `isOccupied` on `bins` that hold stock. If there are
 * more variants than bin locations, the remainder are not inserted (see
 * `variantsSkippedNoEmptyBin`). The `bins` collection must be populated first
 * (e.g. POST /api/bins) with `RACK-BAY-LEVEL` `code` strings.
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
  type Pv = { p: ShopifyProduct; v: ShopifyVariant };
  const pairs: Pv[] = [];
  for (const p of shop.products) {
    for (const v of p.variants ?? []) {
      if (!Number.isFinite(v.id) || !Number.isFinite(p.id)) {
        continue;
      }
      pairs.push({ p, v });
    }
  }
  pairs.sort((a, b) => a.p.id - b.p.id || a.v.id - b.v.id);

  const freeBins = shuffleInPlace([...binCodes]);
  const stockRows: StockDocument[] = [];
  for (const { p, v } of pairs) {
    if (freeBins.length === 0) {
      break;
    }
    const binCode = freeBins.pop()!;
    stockRows.push({
      binCode,
      productId: p.id,
      variantId: v.id,
      sku: catalogSkuForVariant(v).sku,
      quantity: randomQuantity(),
      updatedAt: now,
    });
  }
  const variantsSkippedNoEmptyBin = pairs.length - stockRows.length;

  if (stockRows.length === 0) {
    return { ok: false, error: "No variants to place in bins" };
  }

  const coll = stockCollection(db);
  await coll.deleteMany({});

  await ensureStockCollectionIndexes(client);
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
    variantsSkippedNoEmptyBin,
  };
}
