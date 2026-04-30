import { NextResponse } from "next/server";
import { insertReturnLog } from "@/lib/returnLog";
import { normalizeReturnLineDisposition } from "@/lib/returnLogTypes";
import { normalizeShopifyOrderIdForStorage } from "@/lib/shopifyOrderAdminUrl";

type Body = {
  orderRef?: string;
  /** Shopify REST `order.id` (digits or gid) for admin deep links. */
  shopifyOrderId?: unknown;
  lines?: unknown;
};

const ALLOWED_DISPOSITIONS = new Set([
  "restock",
  "dispose",
  "return_to_sender",
  "wrong_item_received",
]);

function isLine(x: unknown): x is {
  lineId: string;
  sku: string;
  title: string;
  quantity: number;
  unitPrice: number;
  reason: string | null;
  disposition:
    | "restock"
    | "dispose"
    | "return_to_sender"
    | "wrong_item_received";
  notes?: string | null;
} {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.lineId !== "string") return false;
  if (typeof o.sku !== "string") return false;
  if (typeof o.title !== "string") return false;
  if (typeof o.quantity !== "number") return false;
  if (typeof o.unitPrice !== "number") return false;
  if (o.reason !== null && typeof o.reason !== "string") return false;
  if (typeof o.disposition !== "string" || !ALLOWED_DISPOSITIONS.has(o.disposition))
    return false;
  if (o.notes !== undefined && o.notes !== null && typeof o.notes !== "string")
    return false;
  return true;
}

/**
 * POST /api/returns/log
 * Register a return (lines + per-line reason / disposition) in `returnLogs`.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const orderRef = String(body.orderRef ?? "").trim();
  const linesRaw = body.lines;
  if (!orderRef) {
    return NextResponse.json(
      { ok: false, error: "orderRef is required" },
      { status: 400 },
    );
  }
  if (!Array.isArray(linesRaw) || linesRaw.length === 0) {
    return NextResponse.json(
      { ok: false, error: "At least one line is required" },
      { status: 400 },
    );
  }
  const linesNormalized = linesRaw.map((row) => {
    if (!row || typeof row !== "object") return row;
    const o = row as Record<string, unknown>;
    return {
      ...o,
      disposition: normalizeReturnLineDisposition(o.disposition),
    };
  });
  for (const row of linesNormalized) {
    if (!isLine(row)) {
      return NextResponse.json(
        { ok: false, error: "Invalid line payload" },
        { status: 400 },
      );
    }
  }

  const shopifyOrderId = normalizeShopifyOrderIdForStorage(body.shopifyOrderId);

  try {
    const returnUid = await insertReturnLog({
      orderRef,
      ...(shopifyOrderId ? { shopifyOrderId } : {}),
      lines: linesNormalized as Parameters<typeof insertReturnLog>[0]["lines"],
    });
    return NextResponse.json({ ok: true, returnUid });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Insert failed";
    console.error("[returns/log]", e);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
