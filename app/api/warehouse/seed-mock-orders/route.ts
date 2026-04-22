import { NextResponse } from "next/server";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { buildMockOrdersFromProducts } from "@/lib/warehouseMockOrders";

/**
 * POST /api/warehouse/seed-mock-orders
 * Upserts 30 mock orders (2–5 line items each; mean ~2–3). SKUs and locations
 * come from `products`.
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
        {
          projection: {
            sku: 1,
            name: 1,
            color: 1,
            thumbnailImageUrl: 1,
            location: 1,
            unitPricePence: 1,
            _id: 0,
          },
        },
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

    const normalized = products.map((p) => {
      const doc = p as unknown as {
        sku: unknown;
        name: unknown;
        color?: unknown;
        thumbnailImageUrl?: unknown;
        location?: unknown;
        unitPricePence?: unknown;
      };
      return {
        sku: String(doc.sku),
        name: String(doc.name ?? ""),
        color: doc.color != null ? String(doc.color) : undefined,
        thumbnailImageUrl:
          doc.thumbnailImageUrl != null
            ? String(doc.thumbnailImageUrl)
            : undefined,
        location: String(doc.location ?? "").trim() || "U-20-F3",
        unitPricePence:
          typeof doc.unitPricePence === "number" ? doc.unitPricePence : undefined,
      };
    });

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
