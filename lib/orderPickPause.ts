import { randomUUID } from "node:crypto";
import type { Document } from "mongodb";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import type { PickStep } from "@/lib/picklistShared";
import {
  PICKLIST_LIST_KIND_STANDARD,
  PICKLIST_LIST_KIND_UK_PREMIUM,
  type PicklistListKind,
} from "@/lib/picklistListKind";
import { compareKokobayLocation } from "@/lib/kokobayLocationFormat";

export const ORDER_PICK_PAUSES_COLLECTION = "orderPickPauses";

export type OrderPickPauseMissingItem = {
  sku: string;
  location: string;
  name: string;
  quantity: number;
  color?: string;
  size?: string;
};

/**
 * Orders paused from the active pick queue because stock was missing at a
 * bin. Cleared when stock is resolved and picking can resume.
 */
export type OrderPickPauseDoc = {
  pauseUid: string;
  dayKey: string;
  listKind: PicklistListKind;
  orderNumber: string;
  pausedAt: Date;
  updatedAt: Date;
  reason: "missing_stock_at_bin";
  missingItems: OrderPickPauseMissingItem[];
  /**
   * Bin codes (same format as pick steps) where this order had **earlier**
   * stops on the walk before the skip — use to return anything already picked.
   */
  returnToLocations: string[];
};

function listKindQueryFilter(listKind: PicklistListKind) {
  if (listKind === PICKLIST_LIST_KIND_STANDARD) {
    return {
      $or: [
        { listKind: { $exists: false } },
        { listKind: PICKLIST_LIST_KIND_STANDARD },
      ],
    };
  }
  return { listKind: PICKLIST_LIST_KIND_UK_PREMIUM };
}

/** Bin locations to return early picks for `orderNumbers` before `beforeStepIndex` (0-based). */
export function returnBinsForOrdersBeforeStep(
  steps: PickStep[],
  beforeStepIndex: number,
  orderNumbers: ReadonlySet<string>,
): string[] {
  const locs = new Set<string>();
  const max = Math.min(beforeStepIndex, steps.length);
  for (let i = 0; i < max; i += 1) {
    const st = steps[i];
    if (!st) continue;
    const forOs = st.forOrders ?? [];
    if (!forOs.some((o) => orderNumbers.has(o))) continue;
    const loc = String(st.location ?? "").trim();
    if (loc) locs.add(loc);
  }
  return [...locs].sort((a, b) => compareKokobayLocation(a, b));
}

export async function getPausedOrderNumbersSetForPicklistContext(
  dayKey: string,
  listKind: PicklistListKind = PICKLIST_LIST_KIND_STANDARD,
): Promise<Set<string>> {
  const client = await clientPromise;
  const db = client.db(kokobayDbName);
  const col = db.collection(ORDER_PICK_PAUSES_COLLECTION);
  const out = new Set<string>();
  const q = { dayKey, ...listKindQueryFilter(listKind) };
  const cur = col.find(q, { projection: { orderNumber: 1, _id: 0 } });
  for await (const doc of cur) {
    const n = String((doc as { orderNumber?: string }).orderNumber ?? "").trim();
    if (n) out.add(n);
  }
  return out;
}

export type OrderPickPauseListItem = {
  pauseUid: string;
  dayKey: string;
  listKind: PicklistListKind;
  orderNumber: string;
  pausedAt: string;
  updatedAt: string;
  missingItems: OrderPickPauseMissingItem[];
  returnToLocations: string[];
};

export async function listOrderPickPausesForDay(
  dayKey: string,
  listKind: PicklistListKind,
): Promise<OrderPickPauseListItem[]> {
  const client = await clientPromise;
  const db = client.db(kokobayDbName);
  const col = db.collection<OrderPickPauseDoc>(ORDER_PICK_PAUSES_COLLECTION);
  const q = { dayKey, ...listKindQueryFilter(listKind) };
  const docs = await col
    .find(q, { sort: { updatedAt: -1 } })
    .toArray();
  return docs.map((d) => ({
    pauseUid: d.pauseUid,
    dayKey: d.dayKey,
    listKind:
      d.listKind === PICKLIST_LIST_KIND_UK_PREMIUM
        ? PICKLIST_LIST_KIND_UK_PREMIUM
        : PICKLIST_LIST_KIND_STANDARD,
    orderNumber: d.orderNumber,
    pausedAt:
      d.pausedAt instanceof Date
        ? d.pausedAt.toISOString()
        : new Date(0).toISOString(),
    updatedAt:
      d.updatedAt instanceof Date
        ? d.updatedAt.toISOString()
        : new Date(0).toISOString(),
    missingItems: Array.isArray(d.missingItems) ? d.missingItems : [],
    returnToLocations: Array.isArray(d.returnToLocations) ? d.returnToLocations : [],
  }));
}

export async function countOrderPickPausesForDay(
  dayKey: string,
  listKind: PicklistListKind,
): Promise<number> {
  const client = await clientPromise;
  const db = client.db(kokobayDbName);
  return db.collection(ORDER_PICK_PAUSES_COLLECTION).countDocuments({
    dayKey,
    ...listKindQueryFilter(listKind),
  } as never);
}

function qtyForOrderOnStep(step: PickStep, orderNumber: string): number {
  const rows = step.forOrderQuantities;
  if (rows?.length) {
    const hit = rows.find((r) => r.orderNumber === orderNumber);
    if (hit && Number.isFinite(hit.quantity)) {
      return Math.max(0, Math.trunc(hit.quantity));
    }
  }
  const n = step.forOrders.length;
  if (n <= 0) return 0;
  const total = Math.max(0, Math.trunc(step.quantity));
  return Math.max(0, Math.floor(total / n));
}

export type RecordMissingStockPausesInput = {
  dayKey: string;
  listKind: PicklistListKind;
  /** Orders tied to this stop that could not be picked (usually all `step.forOrders`). */
  affectedOrderNumbers: string[];
  /** Full walk steps (same payload as complete). */
  steps: PickStep[];
  /** Current step index in `steps` (0-based) where stock was missing. */
  currentStepIndex: number;
  /** The step where stock was missing (same as `steps[currentStepIndex]` when in sync). */
  currentStep: PickStep;
};

/**
 * Upserts one pause row per affected order, appends the missing line, merges
 * return-to-bin hints from earlier walk stops.
 */
export async function recordMissingStockPauses(
  input: RecordMissingStockPausesInput,
): Promise<{
  pauseUids: string[];
  /** Per order: bins to return anything already picked before this stop. */
  returnHints: { orderNumber: string; returnToLocations: string[] }[];
}> {
  const {
    dayKey,
    listKind,
    affectedOrderNumbers,
    steps,
    currentStepIndex,
    currentStep,
  } = input;
  const sortedOrders = [...new Set(affectedOrderNumbers.map((s) => String(s).trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );
  if (sortedOrders.length === 0) {
    throw new Error("affectedOrderNumbers is empty");
  }
  const allowed = new Set(currentStep.forOrders.map((s) => String(s).trim()).filter(Boolean));
  for (const o of sortedOrders) {
    if (!allowed.has(o)) {
      const err = new Error(
        `Order ${o} is not on the current pick stop; cannot pause for this bin`,
      ) as Error & { code: string };
      err.code = "INVALID_AFFECTED_ORDER";
      throw err;
    }
  }

  const client = await clientPromise;
  const db = client.db(kokobayDbName);
  const col = db.collection<Document>(ORDER_PICK_PAUSES_COLLECTION);
  await col.createIndex({ dayKey: 1, listKind: 1, orderNumber: 1 }, { unique: true });
  await col.createIndex({ pauseUid: 1 }, { unique: true });
  await col.createIndex({ dayKey: 1, listKind: 1, updatedAt: -1 });

  const now = new Date();
  const pauseUids: string[] = [];
  const returnHints: { orderNumber: string; returnToLocations: string[] }[] =
    [];
  const lk =
    listKind === PICKLIST_LIST_KIND_UK_PREMIUM
      ? PICKLIST_LIST_KIND_UK_PREMIUM
      : PICKLIST_LIST_KIND_STANDARD;

  for (const orderNumber of sortedOrders) {
    const returnSet = new Set(
      returnBinsForOrdersBeforeStep(
        steps,
        currentStepIndex,
        new Set([orderNumber]),
      ),
    );
    const qty = qtyForOrderOnStep(currentStep, orderNumber);
    const missingItem: OrderPickPauseMissingItem = {
      sku: String(currentStep.sku ?? "").trim(),
      location: String(currentStep.location ?? "").trim(),
      name: String(currentStep.name ?? "").trim() || String(currentStep.sku ?? "").trim(),
      quantity: qty > 0 ? qty : Math.max(0, Math.trunc(currentStep.quantity)),
      ...(currentStep.color?.trim() ? { color: currentStep.color.trim() } : {}),
      ...(currentStep.size?.trim() ? { size: currentStep.size.trim() } : {}),
    };

    const existing = await col.findOne(
      {
        dayKey,
        orderNumber,
        ...listKindQueryFilter(lk),
      } as never,
      { projection: { pauseUid: 1, returnToLocations: 1, _id: 0 } },
    );
    const raw = existing as unknown as { pauseUid?: unknown; returnToLocations?: string[] } | null;
    const existingUid =
      raw && typeof raw.pauseUid === "string" ? String(raw.pauseUid) : null;
    const prevReturn = (raw?.returnToLocations ?? []) as string[];
    for (const r of prevReturn) {
      const t = String(r).trim();
      if (t) returnSet.add(t);
    }
    const mergedReturn = [...returnSet].sort((a, b) =>
      compareKokobayLocation(a, b),
    );
    returnHints.push({ orderNumber, returnToLocations: mergedReturn });

    if (existingUid) {
      const uid = existingUid;
      pauseUids.push(uid);
      await col.updateOne(
        { pauseUid: uid } as never,
        {
          $set: {
            updatedAt: now,
            returnToLocations: mergedReturn,
          },
          $push: { missingItems: missingItem },
        } as never,
      );
    } else {
      const pauseUid = randomUUID();
      pauseUids.push(pauseUid);
      const doc: OrderPickPauseDoc = {
        pauseUid,
        dayKey,
        listKind: lk,
        orderNumber,
        pausedAt: now,
        updatedAt: now,
        reason: "missing_stock_at_bin",
        missingItems: [missingItem],
        returnToLocations: mergedReturn,
      };
      if (lk === PICKLIST_LIST_KIND_STANDARD) {
        delete (doc as { listKind?: PicklistListKind }).listKind;
      }
      await col.insertOne(doc as unknown as Document);
    }
  }

  return { pauseUids, returnHints };
}

export async function clearOrderPickPauseByUid(pauseUid: string): Promise<{
  deleted: boolean;
}> {
  const client = await clientPromise;
  const db = client.db(kokobayDbName);
  const res = await db
    .collection(ORDER_PICK_PAUSES_COLLECTION)
    .deleteOne({ pauseUid: String(pauseUid).trim() });
  return { deleted: res.deletedCount === 1 };
}
