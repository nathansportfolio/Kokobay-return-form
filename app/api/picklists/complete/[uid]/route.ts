import { NextResponse } from "next/server";
import { deleteCompletedPicklistByUid } from "@/lib/completedPicklist";

type Ctx = { params: Promise<{ uid: string }> };

/**
 * DELETE /api/picklists/complete/:uid
 * Restores the batch’s orders to the active pick lists (undo completion).
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { uid } = await params;
  const u = String(uid ?? "").trim();
  if (!u) {
    return NextResponse.json({ ok: false, error: "Missing uid" }, { status: 400 });
  }
  try {
    const { deleted } = await deleteCompletedPicklistByUid(u);
    if (!deleted) {
      return NextResponse.json(
        { ok: false, error: "No completed pick found with that id" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "Could not undo" },
      { status: 500 },
    );
  }
}
