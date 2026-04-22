import { NextResponse } from "next/server";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { buildMockOrdersFromProducts } from "@/lib/warehouseMockOrders";

/**
 * POST /api/warehouse/seed-mock-orders
 * Upserts 30 mock orders (1–10 lines each). SKUs and locations come from `products`.
 * Run seed-mock-products first so `products` is populated.
 */
export async function POST() {
  try {
    const client = await clientPromise;
    const db = client.db(kokobayDbName);
    const productsCol = db.collection("products");

    const products = await productsCol
      .find(
        { sku: { $regex: /^KB-MOCK-/ } },
        { projection: { sku: 1, name: 1, row: 1, bin: 1, unitPricePence: 1, _id: 0 } },
      )
      .toArray();

    if (products.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No KB-MOCK-* products found. POST /api/warehouse/seed-mock-products first.",
        },
        { status: 400 },
      );
    }

    const normalized = products.map((p) => ({
      sku: String(p.sku),
      name: String(p.name ?? ""),
      row: String(p.row ?? ""),
      bin: String(p.bin ?? ""),
      unitPricePence:
        typeof p.unitPricePence === "number" ? p.unitPricePence : undefined,
    }));

    const ordersCol = db.collection("orders");
    await ordersCol.createIndex({ orderNumber: 1 }, { unique: true });

    const docs = buildMockOrdersFromProducts(normalized);
    let upserted = 0;
    let modified = 0;
    for (const doc of docs) {
      const res = await ordersCol.replaceOne({ orderNumber: doc.orderNumber }, doc, {
        upsert: true,
      });
      upserted += res.upsertedCount;
      modified += res.modifiedCount;
    }

    return NextResponse.json({
      ok: true,
      database: kokobayDbName,
      collection: "orders",
      orderCount: docs.length,
      productSkusUsed: normalized.length,
      upserted,
      modified,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[seed-mock-orders]", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
