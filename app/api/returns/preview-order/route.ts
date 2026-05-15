import { NextResponse } from "next/server";
import { API_JSON_NO_STORE_HEADERS } from "@/lib/apiCacheHeaders";
import {
  logReturnOrderPreview,
  queryDiagnosticsForOrderString,
} from "@/lib/customerReturnOrderPreviewLog";
import { runProductCatalogSyncInBackgroundIfStale } from "@/lib/productCatalogBackgroundSync";
import { previewOrderEmailMatches } from "@/lib/previewOrderEmailMatch";
import {
  fetchReturnOrderFromShopify,
  shopifyOrderDisplayFromLookup,
} from "@/lib/shopifyReturnOrderLookup";

/**
 * GET /api/returns/preview-order?order=…&email=…
 * Resolves a single Shopify order (by customer order name e.g. #1001, short
 * order number, or long Admin `order` id) and returns line items for the return form.
 * Requires `email` to match the order’s email (same message as not found if it does not).
 */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const order = sp.get("order")?.trim() ?? "";
  const email = sp.get("email")?.trim() ?? "";
  const ua = request.headers.get("user-agent")?.slice(0, 240) ?? "";
  const referer = request.headers.get("referer")?.slice(0, 240) ?? "";

  const requestContext = () => ({
    orderQuery: order,
    orderQueryLength: order.length,
    emailProvidedLength: email.length,
    queryDiagnostics: queryDiagnosticsForOrderString(order),
    ...(ua ? { userAgent: ua } : {}),
    ...(referer ? { referer } : {}),
  });

  if (order.length < 1) {
    logReturnOrderPreview("warn", "empty_order_query", {
      ...requestContext(),
      httpStatus: 400,
    });
    return NextResponse.json(
      { ok: false, error: "order query is required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (email.length < 3 || !email.includes("@")) {
    logReturnOrderPreview("warn", "invalid_or_missing_email", {
      ...requestContext(),
      httpStatus: 400,
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          "Enter the email address from your order confirmation so we can verify it’s you.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  logReturnOrderPreview("info", "lookup_started", requestContext());

  try {
    runProductCatalogSyncInBackgroundIfStale();
    const result = await fetchReturnOrderFromShopify(order);
    if (result.ok) {
      const orderEmail = result.email?.trim() ?? "";
      if (!orderEmail) {
        logReturnOrderPreview("warn", "order_lookup_no_email_on_order", {
          ...requestContext(),
          httpStatus: 404,
        });
        return NextResponse.json(
          {
            ok: false,
            error:
              "We couldn’t find that order. Check the number on your confirmation email and try again.",
          },
          { status: 404, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (!previewOrderEmailMatches(orderEmail, email)) {
        logReturnOrderPreview("warn", "order_lookup_email_mismatch", {
          ...requestContext(),
          httpStatus: 404,
        });
        return NextResponse.json(
          {
            ok: false,
            error:
              "We couldn’t find that order. Check the number on your confirmation email and try again.",
          },
          { status: 404, headers: { "Cache-Control": "no-store" } },
        );
      }
      logReturnOrderPreview("info", "lookup_success", {
        ...requestContext(),
        httpStatus: 200,
        resolvedOrderRef: result.orderRef,
        lineCount: result.lines.length,
        shopifyOrderId: result.shopifyOrderId,
        shopifyOrderNumber: result.shopifyOrderNumber,
        shopifyOrderName: result.orderName,
        emailVerified: true,
      });
      return NextResponse.json(
        {
          ok: true,
          orderRef: result.orderRef,
          lines: result.lines,
          shopify: shopifyOrderDisplayFromLookup(result),
        },
        { headers: API_JSON_NO_STORE_HEADERS },
      );
    }
    if (result.error === "not_configured") {
      logReturnOrderPreview("warn", "shopify_not_configured", {
        ...requestContext(),
        httpStatus: 503,
        lookupError: result.error,
      });
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
      logReturnOrderPreview("warn", "order_not_found", {
        ...requestContext(),
        httpStatus: 404,
        lookupError: result.error,
      });
      return NextResponse.json(
        {
          ok: false,
          error:
            "We couldn’t find that order. Check the number on your confirmation email and try again.",
        },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    logReturnOrderPreview("warn", "lookup_rejected", {
      ...requestContext(),
      httpStatus: 400,
      lookupError: result.error,
      message: result.message,
    });
    return NextResponse.json(
      { ok: false, error: result.message ?? "Could not load the order" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    logReturnOrderPreview("error", "lookup_exception", {
      ...requestContext(),
      httpStatus: 500,
      exceptionMessage: e instanceof Error ? e.message : String(e),
      exceptionName: e instanceof Error ? e.name : typeof e,
    });
    console.error("[preview-order]", e);
    return NextResponse.json(
      { ok: false, error: "Could not load line items. Try again in a moment." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
