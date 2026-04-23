import { NextResponse } from "next/server";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { generateBins } from "@/lib/generateBins";

const COLLECTION = "bins";

/**
 * POST /api/bins
 * Regenerates the full `bins` set in the Kokobay MongoDB (replaces previous rows).
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
        { status: 500 },
      );
    }

    await coll.deleteMany({});
    await coll.createIndex({ code: 1 }, { unique: true });
    const { insertedCount } = await coll.insertMany(bins, { ordered: true });

    return NextResponse.json({
      ok: true,
      database: kokobayDbName,
      collection: COLLECTION,
      inserted: insertedCount,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/bins]", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
