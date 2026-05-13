import { NextResponse } from "next/server";
import { insertRefundAuditLog } from "@/lib/refundAuditLog";
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
 * Append one internal audit row when staff completes the “Refund in Shopify” flow
 * in the app (after this handler succeeds, the client opens Admin refund).
 */
export async function POST(request: Request) {
  if (isSiteAccessEnforced()) {
    const role = parseSiteAccessRoleFromCookieHeader(request.headers.get("cookie"));
    if (!role) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const orderRef = parseOptionalTrimmedString(body.orderRef);
  if (!orderRef) {
    return NextResponse.json(
      { ok: false, error: "orderRef is required" },
      { status: 400 },
    );
  }

  const refundedBy = parseWarehouseOperatorLabelFromCookieHeader(
    request.headers.get("cookie"),
  );

  try {
    await insertRefundAuditLog({
      orderRef,
      returnLogId: parseOptionalTrimmedString(body.returnLogId),
      refundAmount: parseRefundAmount(body.refundAmount),
      currency: parseOptionalTrimmedString(body.currency) ?? "GBP",
      customerName: parseOptionalTrimmedString(body.customerName),
      customerEmail: parseOptionalTrimmedString(body.customerEmail),
      shopifyOrderId: parseShopifyOrderIdNumber(body.shopifyOrderId),
      refundedBy,
      source: "shopify_refund_button",
      notes: parseOptionalTrimmedString(body.notes),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[returns/refund-audit]", e);
    return NextResponse.json(
      { ok: false, error: "Could not record refund audit" },
      { status: 500 },
    );
  }
}
