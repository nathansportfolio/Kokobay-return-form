import { NextResponse } from "next/server";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { buildMockWarehouseProducts } from "@/lib/warehouseMockProducts";

/**
 * POST /api/warehouse/seed-mock-products
 * Inserts 200 mock women’s products: colour, womens-wear Unsplash thumbnail,
 * `RACK-BAY-LEVEL` location (Mongo `kokobay` DB).
 * Idempotent for SKU: replaces by `sku` (KB-MOCK-001 … KB-MOCK-200).
 */
export async function POST() {
  try {
    const client = await clientPromise;
    const db = client.db(kokobayDbName);
    const products = db.collection("products");
    const docs = buildMockWarehouseProducts();

    await products.createIndex({ sku: 1 }, { unique: true });

    let upserted = 0;
    let modified = 0;
    for (const doc of docs) {
      const res = await products.replaceOne({ sku: doc.sku }, doc, { upsert: true });
      upserted += res.upsertedCount;
      modified += res.modifiedCount;
    }

    return NextResponse.json({
      ok: true,
      database: kokobayDbName,
      collection: "products",
      count: docs.length,
      upserted,
      modified,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[seed-mock-products]", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
