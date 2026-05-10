import { NextResponse } from "next/server";
import { apiJsonCacheHeaders } from "@/lib/apiCacheHeaders";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { ensureProductCatalogSyncedForWarehouseDay } from "@/lib/shopifyProductCatalog";
import { listDistinctVariantColorsFromProductCatalog } from "@/lib/warehouseProductColors";

export const dynamic = "force-dynamic";

const okCache = { headers: apiJsonCacheHeaders() };
const errHeaders = { headers: { "Cache-Control": "no-store" } };

/**
 * GET /api/warehouse/product-colors
 * Distinct **colour** values from the Shopify product catalog (per-variant rows):
 * only options whose name matches Color/Colour/etc., not the first option
 * (often size). Merges case-insensitively; per-colour variant counts and
 * suggested `#rrggbb` for maps (`hexForProductColorName` — known swatches + hash
 * fallback). After a successful daily sync, `products.color` matches the same
 * rules.
 */
export async function GET() {
  const t0 = Date.now();
  try {
    const client = await clientPromise;
    const db = client.db(kokobayDbName);
    console.log(
      "[api/warehouse/product-colors]",
      "GET: ensuring catalog, then building distinct colors…",
    );
    await ensureProductCatalogSyncedForWarehouseDay(db);
    const colors = await listDistinctVariantColorsFromProductCatalog(db);
    console.log(
      "[api/warehouse/product-colors]",
      `GET: ok in ${Date.now() - t0}ms, colors.length=${colors.length}`,
    );
    return NextResponse.json(
      { ok: true, colors } as const,
      okCache,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/warehouse/product-colors]", e);
    return NextResponse.json(
      { ok: false, error: message } as const,
      { status: 500, ...errHeaders },
    );
  }
}
