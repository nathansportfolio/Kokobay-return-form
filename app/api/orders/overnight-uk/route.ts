import { NextResponse } from "next/server";

import { fetchOvernightUkOrderSummaries } from "@/lib/fetchOvernightUkShopifyOrders";

/**
 * GET /api/orders/overnight-uk
 *
 * Orders created from **yesterday 17:00** to **today 08:30** (Europe/London).
 * Response: customer name, email, and line items (title + quantity only).
 */
export async function GET() {
  try {
    const result = await fetchOvernightUkOrderSummaries();
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 500 },
      );
    }
    return NextResponse.json(
      {
        window: result.window,
        count: result.orders.length,
        orders: result.orders,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
