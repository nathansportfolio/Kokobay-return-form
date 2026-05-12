import { NextResponse } from "next/server";
import { insertCompletedPicklist } from "@/lib/completedPicklist";
import type { OrderAssembly, PickStep } from "@/lib/fetchTodaysPickLists";
import {
  PICKLIST_LIST_KIND_STANDARD,
  PICKLIST_LIST_KIND_UK_PREMIUM,
  type PicklistListKind,
} from "@/lib/picklistListKind";
import { clampItemsPerList } from "@/lib/picklistShared";

type Body = {
  dayKey?: string;
  orderNumbers?: string[];
  batchIndex?: number;
  ordersPerList?: number;
  itemsPerList?: number;
  steps?: unknown;
  assembly?: unknown;
  totalItemsQty?: number;
  orderCount?: number;
  /** Milliseconds from opening the walk to pressing Finish. */
  durationMs?: number;
  /** Omitted = standard (yesterday’s order day); `uk_premium` = UK Premium NDD list. */
  listKind?: string;
};

function parseListKind(raw: unknown): PicklistListKind {
  const s = String(raw ?? "").trim();
  if (s === "uk_premium" || s === PICKLIST_LIST_KIND_UK_PREMIUM) {
    return PICKLIST_LIST_KIND_UK_PREMIUM;
  }
  if (s === "" || s === "standard" || s === PICKLIST_LIST_KIND_STANDARD) {
    return PICKLIST_LIST_KIND_STANDARD;
  }
  return PICKLIST_LIST_KIND_STANDARD;
}

function isPickStepArray(x: unknown): x is PickStep[] {
  if (!Array.isArray(x)) return false;
  for (const s of x) {
    if (!s || typeof s !== "object") return false;
    const o = s as Record<string, unknown>;
    if (typeof o.step !== "number") return false;
    if (typeof o.sku !== "string") return false;
    if (typeof o.name !== "string") return false;
    if (typeof o.location !== "string") return false;
    if (typeof o.quantity !== "number") return false;
    if (
      o.sourceLineItemCount !== undefined &&
      typeof o.sourceLineItemCount !== "number"
    ) {
      return false;
    }
    if (!Array.isArray(o.forOrders)) return false;
    for (const fo of o.forOrders) {
      if (typeof fo !== "string") return false;
    }
    if (o.color !== undefined && typeof o.color !== "string") return false;
    if (
      o.thumbnailImageUrl !== undefined &&
      typeof o.thumbnailImageUrl !== "string"
    ) {
      return false;
    }
    if (o.colorHex !== undefined && typeof o.colorHex !== "string") {
      return false;
    }
    if (o.size !== undefined && typeof o.size !== "string") {
      return false;
    }
    if (o.forOrderLineRowCounts !== undefined) {
      if (!Array.isArray(o.forOrderLineRowCounts)) return false;
      for (const row of o.forOrderLineRowCounts) {
        if (!row || typeof row !== "object") return false;
        const e = row as Record<string, unknown>;
        if (typeof e.orderNumber !== "string") return false;
        if (typeof e.lineRows !== "number") return false;
      }
    }
    if (o.forOrderQuantities !== undefined) {
      if (!Array.isArray(o.forOrderQuantities)) return false;
      for (const row of o.forOrderQuantities) {
        if (!row || typeof row !== "object") return false;
        const e = row as Record<string, unknown>;
        if (typeof e.orderNumber !== "string") return false;
        if (typeof e.quantity !== "number") return false;
      }
    }
  }
  return true;
}

function isOrderAssemblyArray(x: unknown): x is OrderAssembly[] {
  if (!Array.isArray(x)) return false;
  for (const a of x) {
    if (!a || typeof a !== "object") return false;
    const o = a as Record<string, unknown>;
    if (typeof o.orderNumber !== "string") return false;
    if (
      o.customerFirstName !== undefined &&
      typeof o.customerFirstName !== "string"
    ) {
      return false;
    }
    if (
      o.customerLastName !== undefined &&
      typeof o.customerLastName !== "string"
    ) {
      return false;
    }
    if (!Array.isArray(o.lines)) return false;
    for (const line of o.lines) {
      if (!line || typeof line !== "object") return false;
      const l = line as Record<string, unknown>;
      if (typeof l.lineIndex !== "number") return false;
      if (typeof l.sku !== "string") return false;
      if (typeof l.quantity !== "number") return false;
      if (typeof l.name !== "string") return false;
      if (l.color !== undefined && typeof l.color !== "string") return false;
      if (
        l.thumbnailImageUrl !== undefined &&
        typeof l.thumbnailImageUrl !== "string"
      ) {
        return false;
      }
      if (l.colorHex !== undefined && typeof l.colorHex !== "string") {
        return false;
      }
      if (l.size !== undefined && typeof l.size !== "string") {
        return false;
      }
    }
  }
  return true;
}

/**
 * POST /api/picklists/complete
 * Record a completed pick; those orders are excluded from today’s active lists.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const dayKey = String(body.dayKey ?? "").trim();
  const orderNumbers = Array.isArray(body.orderNumbers)
    ? body.orderNumbers.map((s) => String(s))
    : [];
  const batchIndex = Number(body.batchIndex);
  const ordersPerList = Number(body.ordersPerList);
  const itemsPerList = clampItemsPerList(Number(body.itemsPerList));
  const steps = body.steps;
  const assembly = body.assembly;
  const totalItemsQty = Number(body.totalItemsQty);
  const orderCount = Number(body.orderCount);
  const durationRaw = body.durationMs;
  const durationMs = Number(durationRaw);
  const listKind = parseListKind(body.listKind);

  if (!dayKey || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    return NextResponse.json(
      { ok: false, error: "dayKey is required (YYYY-MM-DD)" },
      { status: 400 },
    );
  }
  if (!isPickStepArray(steps) || !isOrderAssemblyArray(assembly)) {
    return NextResponse.json(
      { ok: false, error: "Invalid steps or assembly" },
      { status: 400 },
    );
  }
  if (
    Number.isNaN(batchIndex) ||
    batchIndex < 1 ||
    Number.isNaN(ordersPerList) ||
    ordersPerList < 1 ||
    orderNumbers.length === 0
  ) {
    return NextResponse.json(
      { ok: false, error: "Invalid batch or order list" },
      { status: 400 },
    );
  }
  if (Number.isNaN(totalItemsQty) || totalItemsQty < 0) {
    return NextResponse.json({ ok: false, error: "Invalid totalItemsQty" }, { status: 400 });
  }
  if (Number.isNaN(orderCount) || orderCount < 1) {
    return NextResponse.json({ ok: false, error: "Invalid orderCount" }, { status: 400 });
  }
  if (durationRaw !== undefined) {
    if (Number.isNaN(durationMs) || durationMs < 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid durationMs" },
        { status: 400 },
      );
    }
    if (durationMs > 12 * 60 * 60 * 1000) {
      return NextResponse.json(
        { ok: false, error: "durationMs is too large" },
        { status: 400 },
      );
    }
  }

  try {
    const picklistUid = await insertCompletedPicklist({
      dayKey,
      orderNumbers,
      batchIndex,
      ordersPerList,
      itemsPerList,
      steps,
      assembly,
      totalItemsQty,
      orderCount,
      durationMs: Number.isFinite(durationMs) && durationMs >= 0 ? Math.floor(durationMs) : 0,
      listKind,
    });
    return NextResponse.json({ ok: true, picklistUid });
  } catch (e) {
    const err = e as Error & { code?: string };
    if (err.code === "ALREADY_COMPLETED") {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: 409 },
      );
    }
    if (err.code === "ORDER_PAUSED") {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: 409 },
      );
    }
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "Could not save completed pick" },
      { status: 500 },
    );
  }
}
