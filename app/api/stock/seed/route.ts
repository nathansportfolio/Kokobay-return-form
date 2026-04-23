import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { seedStockFromShopify } from "@/lib/seedStockFromShopify";

/**
 * POST /api/stock/seed
 * Replaces the `stock` collection: fetches all Shopify product variants, assigns
 * each to a **unique** `bins.code` (at most one SKU per bin; bins are
 * shuffled for randomness). Random quantity 1–20, updates `isOccupied` on
 * bins. Excess variants (if more SKUs than bin cells) are omitted; see
 * `variantsSkippedNoEmptyBin` in the JSON body.
 * Requires: bins seeded (`POST /api/bins`) and `SHOPIFY_*` env.
 */
export async function POST() {
  try {
    const client = await clientPromise;
    const result = await seedStockFromShopify(client);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/stock/seed]", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
