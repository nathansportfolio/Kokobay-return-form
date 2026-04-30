import { NextResponse } from "next/server";
import { insertReturnLog } from "@/lib/returnLog";
import { normalizeShopifyOrderIdForStorage } from "@/lib/shopifyOrderAdminUrl";

type Body = {
  orderRef?: string;
  /** Shopify REST `order.id` (digits or gid) for admin deep links. */
  shopifyOrderId?: unknown;
  lines?: unknown;
};

function isLine(x: unknown): x is {
  lineId: string;
  sku: string;
  title: string;
  quantity: number;
  unitPrice: number;
  reason: string | null;
  disposition: "restock" | "dispose";
} {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.lineId !== "string") return false;
  if (typeof o.sku !== "string") return false;
  if (typeof o.title !== "string") return false;
  if (typeof o.quantity !== "number") return false;
  if (typeof o.unitPrice !== "number") return false;
  if (o.reason !== null && typeof o.reason !== "string") return false;
  if (o.disposition !== "restock" && o.disposition !== "dispose")
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
  for (const row of linesRaw) {
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
      lines: linesRaw,
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
