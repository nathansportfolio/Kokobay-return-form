import { NextResponse } from "next/server";
import { apiJsonCacheHeaders } from "@/lib/apiCacheHeaders";
import { runProductCatalogSyncInBackgroundIfStale } from "@/lib/productCatalogBackgroundSync";
import {
  fetchReturnOrderFromShopify,
  shopifyOrderDisplayFromLookup,
} from "@/lib/shopifyReturnOrderLookup";

/**
 * GET /api/returns/preview-order?order=…
 * Resolves a single Shopify order (by customer order name e.g. #1001, short
 * order number, or long Admin `order` id) and returns line items for the return form.
 */
export async function GET(request: Request) {
  const order = new URL(request.url).searchParams.get("order")?.trim() ?? "";
  if (order.length < 1) {
    return NextResponse.json(
      { ok: false, error: "order query is required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    runProductCatalogSyncInBackgroundIfStale();
    const result = await fetchReturnOrderFromShopify(order);
    if (result.ok) {
      return NextResponse.json(
        {
          ok: true,
          orderRef: result.orderRef,
          lines: result.lines,
          shopify: shopifyOrderDisplayFromLookup(result),
        },
        { headers: apiJsonCacheHeaders() },
      );
    }
    if (result.error === "not_configured") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Order lookup is not configured. Set SHOPIFY_STORE and API credentials in the environment.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (result.error === "not_found") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "We couldn’t find that order. Check the number on your confirmation email and try again.",
        },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { ok: false, error: result.message ?? "Could not load the order" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[preview-order]", e);
    return NextResponse.json(
      { ok: false, error: "Could not load line items. Try again in a moment." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
