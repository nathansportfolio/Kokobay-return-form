import { NextResponse } from "next/server";
import { createShopifyRefund } from "@/lib/createShopifyRefund";
import {
  REFUND_AUDIT_LOGS_COLLECTION,
  insertRefundAuditLog,
} from "@/lib/refundAuditLog";
import { shopifyOrderAdminUrlByOrderId } from "@/lib/shopifyOrderAdminUrl";
import {
  isSiteAccessEnforced,
  parseSiteAccessRoleFromCookieHeader,
  parseWarehouseOperatorLabelFromCookieHeader,
} from "@/lib/siteAccess";

export const dynamic = "force-dynamic";

type Body = {
  orderRef?: unknown;
  returnLogId?: unknown;
  refundAmount?: unknown;
  currency?: unknown;
  customerName?: unknown;
  customerEmail?: unknown;
  shopifyOrderId?: unknown;
  notes?: unknown;
};

function parseOptionalTrimmedString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function parseShopifyOrderIdNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.trunc(v);
  }
  const s = String(v).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parseRefundAmount(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v));
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

/**
 * POST /api/returns/refund-audit
 *
 * Triggered by the warehouse **Refund in Shopify** control (`ShopifyRefundAuditButton`).
 * Flow: Shopify Admin REST **refund create** (calculate → refunds.json), then append
 * one row to Mongo **`refundAuditLogs`** only after Shopify returns success.
 */
export async function POST(request: Request) {
  console.log("[refund] POST /api/returns/refund-audit");

  if (!process.env.SHOPIFY_STORE?.trim()) {
    console.log("[refund] early return: SHOPIFY_STORE not set");
    return NextResponse.json(
      { ok: false, error: "Shopify is not configured" },
      { status: 503 },
    );
  }

  if (isSiteAccessEnforced()) {
    const role = parseSiteAccessRoleFromCookieHeader(request.headers.get("cookie"));
    if (!role) {
      console.log("[refund] early return: Unauthorized (no site_access cookie)");
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    console.log("[refund] early return: invalid JSON body");
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const orderRef = parseOptionalTrimmedString(body.orderRef);
  if (!orderRef) {
    console.log("[refund] early return: orderRef required");
    return NextResponse.json(
      { ok: false, error: "orderRef is required" },
      { status: 400 },
    );
  }

  const shopifyOrderIdHint = parseOptionalTrimmedString(body.shopifyOrderId);
  const refundedBy = parseWarehouseOperatorLabelFromCookieHeader(
    request.headers.get("cookie"),
  );

  console.log("[refund] starting Shopify refund", { orderRef, shopifyOrderIdHint });

  const refundResult = await createShopifyRefund(orderRef, shopifyOrderIdHint);

  if (!refundResult.ok) {
    console.error("[refund] Shopify refund failed", refundResult);
    return NextResponse.json(
      { ok: false, error: refundResult.error },
      { status: refundResult.status && refundResult.status >= 400 ? refundResult.status : 502 },
    );
  }

  console.log("[refund] Shopify refund success", {
    shopifyRefundId: refundResult.shopifyRefundId,
    orderId: refundResult.orderId,
  });

  const adminOrderUrl = shopifyOrderAdminUrlByOrderId(refundResult.orderId);

  console.log("[refund] inserting refund audit log", {
    collection: REFUND_AUDIT_LOGS_COLLECTION,
    orderRef,
    returnLogId: parseOptionalTrimmedString(body.returnLogId),
  });

  try {
    await insertRefundAuditLog({
      orderRef,
      returnLogId: parseOptionalTrimmedString(body.returnLogId),
      refundAmount: parseRefundAmount(body.refundAmount),
      currency: parseOptionalTrimmedString(body.currency) ?? "GBP",
      customerName: parseOptionalTrimmedString(body.customerName),
      customerEmail: parseOptionalTrimmedString(body.customerEmail),
      shopifyOrderId: parseShopifyOrderIdNumber(
        shopifyOrderIdHint ?? refundResult.orderId,
      ),
      refundedBy,
      source: "shopify_refund_button",
      notes: parseOptionalTrimmedString(body.notes),
    });
    console.log("[refund] refund audit log inserted");
  } catch (e) {
    console.error("[refund] refund audit insert failed", e);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Shopify refund succeeded but saving the internal audit log failed. Check server logs.",
        shopifyRefundId: refundResult.shopifyRefundId,
        adminOrderUrl,
      },
      { status: 500 },
    );
  }

  console.log("[refund] complete");
  return NextResponse.json({
    ok: true,
    shopifyRefundId: refundResult.shopifyRefundId,
    adminOrderUrl,
  });
}
