import { NextResponse } from "next/server";
import {
  REFUND_AUDIT_LOGS_COLLECTION,
  insertRefundAuditLog,
} from "@/lib/refundAuditLog";
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
 * Triggered after staff open **Shopify Admin → Refund** from the app (the client
 * opens `href` first). This route **only** appends to Mongo **`refundAuditLogs`** —
 * no Shopify Admin REST refund (avoids extra OAuth scopes / permission errors).
 * Actual money movement stays in Shopify’s UI (or webhooks you already ingest).
 */
export async function POST(request: Request) {
  console.log("[refund] POST /api/returns/refund-audit (audit-only)");

  if (isSiteAccessEnforced()) {
    const role = parseSiteAccessRoleFromCookieHeader(request.headers.get("cookie"));
    if (!role) {
      console.log("[refund] early return: Unauthorized");
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    console.log("[refund] early return: invalid JSON");
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

  console.log("[refund] inserting refund audit log", {
    collection: REFUND_AUDIT_LOGS_COLLECTION,
    orderRef,
  });

  try {
    await insertRefundAuditLog({
      orderRef,
      returnLogId: parseOptionalTrimmedString(body.returnLogId),
      refundAmount: parseRefundAmount(body.refundAmount),
      currency: parseOptionalTrimmedString(body.currency) ?? "GBP",
      customerName: parseOptionalTrimmedString(body.customerName),
      customerEmail: parseOptionalTrimmedString(body.customerEmail),
      shopifyOrderId: parseShopifyOrderIdNumber(shopifyOrderIdHint),
      refundedBy,
      source: "shopify_refund_button",
      notes: parseOptionalTrimmedString(body.notes),
    });
    console.log("[refund] refund audit log inserted");
  } catch (e) {
    console.error("[refund] refund audit insert failed", e);
    return NextResponse.json(
      { ok: false, error: "Could not record refund audit" },
      { status: 500 },
    );
  }

  console.log("[refund] complete");
  return NextResponse.json({ ok: true });
}
