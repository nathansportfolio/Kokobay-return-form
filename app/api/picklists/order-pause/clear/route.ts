import { NextResponse } from "next/server";
import { clearOrderPickPauseByUid } from "@/lib/orderPickPause";

type Body = {
  pauseUid?: string;
};

/**
 * POST /api/picklists/order-pause/clear
 * Remove a missing-stock hold so the order can appear on the active pick list again.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const pauseUid = String(body.pauseUid ?? "").trim();
  if (!pauseUid) {
    return NextResponse.json({ ok: false, error: "pauseUid is required" }, { status: 400 });
  }
  try {
    const { deleted } = await clearOrderPickPauseByUid(pauseUid);
    if (!deleted) {
      return NextResponse.json(
        { ok: false, error: "No pause found for that id" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "Could not clear pause" },
      { status: 500 },
    );
  }
}
