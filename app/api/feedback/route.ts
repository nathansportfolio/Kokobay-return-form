import { NextResponse } from "next/server";
import {
  insertCustomerFeedback,
  validateCustomerFeedback,
} from "@/lib/customerFeedback";

export const dynamic = "force-dynamic";

/**
 * POST /api/feedback
 * Store a 1–5 star customer feedback submission.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const v = validateCustomerFeedback(body);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
  }

  try {
    await insertCustomerFeedback({
      rating: v.data.rating,
      comment: v.data.comment,
      userAgent: request.headers.get("user-agent"),
    });
  } catch (e) {
    console.error("[feedback] insert failed", e);
    return NextResponse.json(
      { ok: false, error: "Could not save feedback. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
