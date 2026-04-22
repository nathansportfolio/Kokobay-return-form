import { NextResponse } from "next/server";
import { getReturnOrderLinesFromProducts } from "@/lib/returnOrderLinesFromProducts";

/**
 * GET /api/returns/preview-order?order=…
 * Sample line items for an order ref (public; same source as other return flows).
 */
export async function GET(request: Request) {
  const order = new URL(request.url).searchParams.get("order")?.trim() ?? "";
  if (order.length < 1) {
    return NextResponse.json(
      { ok: false, error: "order query is required" },
      { status: 400 },
    );
  }
  try {
    const lines = await getReturnOrderLinesFromProducts(order);
    if (lines.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No product lines available" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, orderRef: order, lines });
  } catch (e) {
    console.error("[preview-order]", e);
    return NextResponse.json(
      { ok: false, error: "Could not load line items" },
      { status: 500 },
    );
  }
}
