import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { buildCatalogProductRows } from "@/lib/buildCatalogProductRows";
import {
  compareKokobayLocation,
} from "@/lib/kokobayLocationFormat";
import { shopifyAdminGet } from "@/lib/shopifyAdminApi";
import type { ShopifyProductsResponse } from "@/types/shopify";
import type { CatalogProductRow } from "@/types/catalogProduct";
import type { WarehouseProduct } from "@/lib/warehouseMockProducts";

type Result =
  | { ok: true; rows: CatalogProductRow[]; shopifyError?: never }
  | { ok: false; error: string; rows: CatalogProductRow[] };

type MongoRow = Pick<
  WarehouseProduct,
  | "sku"
  | "name"
  | "location"
  | "unitPricePence"
  | "quantityAvailable"
  | "color"
  | "category"
  | "thumbnailImageUrl"
>;

async function loadMongoBySkus(
  skus: string[],
): Promise<Map<string, MongoRow>> {
  const m = new Map<string, MongoRow>();
  if (skus.length === 0) return m;
  try {
    const client = await clientPromise;
    const col = client
      .db(kokobayDbName)
      .collection<WarehouseProduct>("products");
    const docs = await col
      .find(
        { sku: { $in: skus } },
        {
          projection: {
            sku: 1,
            name: 1,
            location: 1,
            unitPricePence: 1,
            quantityAvailable: 1,
            color: 1,
            category: 1,
            thumbnailImageUrl: 1,
          },
        },
      )
      .toArray();
    for (const d of docs) {
      const sku = String(d.sku ?? "").trim();
      if (sku) m.set(sku, d as MongoRow);
    }
  } catch {
    /* Mongo not configured or transient — UI still works from Shopify with placeholders */
  }
  return m;
}

/**
 * Live Shopify products merged with `products` in Mongo by SKU.
 * Unknown / invalid `location` in the DB is replaced with a placeholder code.
 * Rows are sorted in warehouse walk order by `location`.
 */
export async function getWarehouseProductCatalog(): Promise<Result> {
  const empty: CatalogProductRow[] = [];
  try {
    const { ok, data } =
      await shopifyAdminGet<ShopifyProductsResponse>("products.json?limit=250");
    if (!ok) {
      return { ok: false, error: "Could not load products from Shopify", rows: empty };
    }
    const products = data?.products ?? [];
    const skus: string[] = [];
    for (const p of products) {
      for (const v of p.variants) {
        const s = (v.sku && String(v.sku).trim()) || "";
        if (s) skus.push(s);
      }
    }
    const bySku = await loadMongoBySkus([...new Set(skus)]);
    const rows = buildCatalogProductRows(products, bySku);
    rows.sort((a, b) => compareKokobayLocation(a.location, b.location));
    return { ok: true, rows };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: message, rows: empty };
  }
}
