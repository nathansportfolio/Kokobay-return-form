import { NextResponse } from "next/server";
import { pickStepMetaIsValid, type PickStep } from "@/lib/picklistShared";
import {
  PICKLIST_LIST_KIND_STANDARD,
  PICKLIST_LIST_KIND_UK_PREMIUM,
  type PicklistListKind,
} from "@/lib/picklistListKind";
import { recordMissingStockPauses } from "@/lib/orderPickPause";

type Body = {
  dayKey?: string;
  listKind?: string;
  affectedOrderNumbers?: string[];
  steps?: unknown;
  currentStepIndex?: number;
  currentStep?: unknown;
};

function parseListKind(raw: unknown): PicklistListKind {
  const s = String(raw ?? "").trim();
  if (s === "uk_premium" || s === PICKLIST_LIST_KIND_UK_PREMIUM) {
    return PICKLIST_LIST_KIND_UK_PREMIUM;
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
    if (!pickStepMetaIsValid(o.meta)) {
      return false;
    }
  }
  return true;
}

function isPickStep(x: unknown): x is PickStep {
  return isPickStepArray([x]);
}

/**
 * POST /api/picklists/pause-missing-stock
 * Pause affected orders (off active pick queue) and record missing line + return hints.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const dayKey = String(body.dayKey ?? "").trim();
  const listKind = parseListKind(body.listKind);
  const affected = Array.isArray(body.affectedOrderNumbers)
    ? body.affectedOrderNumbers.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const steps = body.steps;
  const currentStepIndex = Number(body.currentStepIndex);
  const currentStep = body.currentStep;

  if (!dayKey || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    return NextResponse.json(
      { ok: false, error: "dayKey is required (YYYY-MM-DD)" },
      { status: 400 },
    );
  }
  if (!isPickStepArray(steps) || !isPickStep(currentStep)) {
    return NextResponse.json(
      { ok: false, error: "Invalid steps or currentStep" },
      { status: 400 },
    );
  }
  if (Number.isNaN(currentStepIndex) || currentStepIndex < 0 || currentStepIndex >= steps.length) {
    return NextResponse.json(
      { ok: false, error: "currentStepIndex is out of range for steps" },
      { status: 400 },
    );
  }
  const at = steps[currentStepIndex];
  if (
    !at ||
    at.step !== currentStep.step ||
    at.sku !== currentStep.sku ||
    at.location !== currentStep.location
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "currentStep does not match steps[currentStepIndex]",
      },
      { status: 400 },
    );
  }
  if (affected.length === 0) {
    return NextResponse.json(
      { ok: false, error: "affectedOrderNumbers is required" },
      { status: 400 },
    );
  }

  try {
    const result = await recordMissingStockPauses({
      dayKey,
      listKind,
      affectedOrderNumbers: affected,
      steps,
      currentStepIndex,
      currentStep,
    });
    return NextResponse.json({
      ok: true,
      pauseUids: result.pauseUids,
      returnHints: result.returnHints,
    });
  } catch (e) {
    const err = e as Error & { code?: string };
    if (err.code === "INVALID_AFFECTED_ORDER") {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "Could not record pause" },
      { status: 500 },
    );
  }
}
