import { NextResponse } from "next/server";
import { apiJsonCacheHeaders } from "@/lib/apiCacheHeaders";
import { getBinsLayoutTree } from "@/lib/getBinsLayoutTree";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { generateBins } from "@/lib/generateBins";

const COLLECTION = "bins";

/**
 * GET /api/bins
 * Returns racks → bays → levels with `isOccupied` (same tree as the warehouse
 * layout page; read-only).
 */
export async function GET() {
  try {
    const data = await getBinsLayoutTree();
    if (!data.ok) {
      return NextResponse.json(data, {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      });
    }
    return NextResponse.json(data, { headers: apiJsonCacheHeaders() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message, racks: [] },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

/**
 * POST /api/bins
 * Regenerates the full `bins` set in the Kokobay MongoDB (replaces previous rows).
 * Codes: `[RACK]-[BAY]-[LEVEL]` (e.g. `A-13-F`), see `lib/generateBins.ts`.
 */
export async function POST() {
  try {
    const client = await clientPromise;
    const db = client.db(kokobayDbName);
    const coll = db.collection(COLLECTION);

    const bins = generateBins();
    if (bins.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No bins generated" },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }

    await coll.deleteMany({});
    await coll.createIndex({ code: 1 }, { unique: true });
    const { insertedCount } = await coll.insertMany(bins, { ordered: true });

    return NextResponse.json(
      {
        ok: true,
        database: kokobayDbName,
        collection: COLLECTION,
        inserted: insertedCount,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/bins]", e);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
