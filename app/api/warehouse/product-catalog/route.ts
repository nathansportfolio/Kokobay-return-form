import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import {
  ensureProductCatalogSyncedForWarehouseDay,
  getAllProductCatalog,
  getProductCatalogBySkus,
  getProductCatalogCountAndLatestSync,
  runShopifyProductCatalogSync,
  searchProductCatalog,
  type ProductCatalogEntry,
} from "@/lib/shopifyProductCatalog";

type OkItems = { ok: true; items: ProductCatalogEntry[] };
type OkMeta = {
  ok: true;
  count: number;
  lastSync: string | null;
  lastSyncDay: string | null;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message } as const, { status });
}

/**
 * GET /api/warehouse/product-catalog
 * - `?meta=1` — `{ count, lastSync, lastSyncDay }` (London warehouse day for feed freshness)
 * - `?all=1` — all catalog rows (cap 10k) for “add all to sheet”
 * - `?skus=a,b,c` — look up by SKU
 * - `?q=term&limit=40` — case-insensitive substring match on SKU or title
 */
export async function GET(request: NextRequest) {
  try {
    const noCache = { headers: { "Cache-Control": "private, no-store" } };
    const client = await clientPromise;
    const db = client.db(kokobayDbName);
    await ensureProductCatalogSyncedForWarehouseDay(db);
    const p = request.nextUrl.searchParams;
    if (p.get("meta") === "1") {
      const m = await getProductCatalogCountAndLatestSync(db);
      return NextResponse.json(
        {
          ok: true,
          count: m.count,
          lastSync: m.lastSync,
          lastSyncDay: m.lastSyncDay,
        } satisfies OkMeta,
        noCache,
      );
    }
    if (p.get("all") === "1") {
      const cap = Math.min(10_000, Number(p.get("cap")) || 5_000);
      const items = await getAllProductCatalog(db, cap);
      return NextResponse.json(
        { ok: true, items } satisfies OkItems,
        noCache,
      );
    }
    const skusP = p.get("skus");
    if (skusP) {
      const list = skusP
        .split(/[,\n;]+/g)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!list.length) {
        return NextResponse.json(
          { ok: true, items: [] } satisfies OkItems,
          noCache,
        );
      }
      const items = await getProductCatalogBySkus(db, list);
      return NextResponse.json(
        { ok: true, items } satisfies OkItems,
        noCache,
      );
    }
    const q = p.get("q");
    if (q != null && String(q).trim() !== "") {
      const limit = Math.min(200, Math.max(1, Number(p.get("limit")) || 40));
      const items = await searchProductCatalog(db, { q, limit, minLength: 1 });
      return NextResponse.json(
        { ok: true, items } satisfies OkItems,
        noCache,
      );
    }

    return bad(
      "Use ?meta=1, ?all=1, ?skus=, or ?q= (and optional &limit=)",
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/warehouse/product-catalog GET]", e);
    return bad(message, 500);
  }
}

/**
 * POST /api/warehouse/product-catalog
 * Fetches all active products from Shopify and upserts into Mongo (by SKU).
 * Requires `SHOPIFY_*` env. Safe to re-run; typical duration a few seconds for
 * a few hundred variants.
 */
export async function POST() {
  try {
    const client = await clientPromise;
    const result = await runShopifyProductCatalogSync(client.db(kokobayDbName));
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error } as const,
        { status: 400 },
      );
    }
    return NextResponse.json({
      ok: true,
      count: result.count,
      withSku: result.withSku,
      lastSync: result.lastSync,
      lastSyncDay: result.lastSyncDay,
      catalogDeleted: result.catalogDeleted,
      productsUpserted: result.productsUpserted,
      productsDeleted: result.productsDeleted,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/warehouse/product-catalog POST]", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
