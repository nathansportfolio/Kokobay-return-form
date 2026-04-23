import { NextResponse } from "next/server";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { isLayoutAction, type LayoutMutationResult } from "@/lib/binLayoutTypes";
import { runLayoutMutation } from "@/lib/binLayoutMutations";

/**
 * POST /api/bins/layout
 * Add/remove rack, bay, or level rows in `bins` (and related `stock` cleanup).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<LayoutMutationResult>(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  if (!isLayoutAction(body)) {
    return NextResponse.json<LayoutMutationResult>(
      { ok: false, error: "Invalid or incomplete layout action." },
      { status: 400 },
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db(kokobayDbName);
    const out = await runLayoutMutation(db, body);
    return NextResponse.json<LayoutMutationResult>(out, {
      status: out.ok ? 200 : 400,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/bins/layout]", e);
    return NextResponse.json<LayoutMutationResult>(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
