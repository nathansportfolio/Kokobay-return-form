import { randomUUID } from "node:crypto";
import type { Document } from "mongodb";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import type { OrderAssembly, PickStep } from "@/lib/fetchTodaysPickLists";

export const COMPLETED_PICKLISTS_COLLECTION = "completedPicklists";

/**
 * A finished pick walk for a warehouse day, stored for audit and so those
 * orders stay off the active pick list until undo.
 */
export type CompletedPicklistDoc = {
  picklistUid: string;
  dayKey: string;
  orderNumbers: string[];
  /** Batch index the picker saw when they started (1-based, that day + batching). */
  batchIndex: number;
  ordersPerList: number;
  steps: PickStep[];
  assembly: OrderAssembly[];
  totalItemsQty: number;
  orderCount: number;
  /** Elapsed from opening the walk (Start pick list) to Finish, in ms. Omitted for legacy rows. */
  durationMs?: number;
  completedAt: Date;
};

export async function getCompletedOrderNumbersSetForDay(
  dayKey: string,
): Promise<Set<string>> {
  const client = await clientPromise;
  const db = client.db(kokobayDbName);
  const col = db.collection(COMPLETED_PICKLISTS_COLLECTION);
  const out = new Set<string>();
  const cur = col.find(
    { dayKey },
    { projection: { orderNumbers: 1, _id: 0 } },
  );
  for await (const doc of cur) {
    const nums = (doc as { orderNumbers?: string[] }).orderNumbers;
    for (const n of nums ?? []) {
      if (n) out.add(n);
    }
  }
  return out;
}

export async function countCompletedPicklistsForDay(
  dayKey: string,
): Promise<number> {
  const client = await clientPromise;
  const db = client.db(kokobayDbName);
  return db
    .collection(COMPLETED_PICKLISTS_COLLECTION)
    .countDocuments({ dayKey });
}

export type CompletedPicklistListItem = {
  picklistUid: string;
  dayKey: string;
  orderNumbers: string[];
  batchIndex: number;
  ordersPerList: number;
  totalItemsQty: number;
  orderCount: number;
  completedAt: string;
  stopCount: number;
};

export async function listCompletedPicklistsForDay(
  dayKey: string,
): Promise<CompletedPicklistListItem[]> {
  const client = await clientPromise;
  const db = client.db(kokobayDbName);
  const col = db.collection<CompletedPicklistDoc>(COMPLETED_PICKLISTS_COLLECTION);
  const docs = await col
    .find({ dayKey }, { sort: { completedAt: -1 } })
    .toArray();
  return docs.map((d) => ({
    picklistUid: d.picklistUid,
    dayKey: d.dayKey,
    orderNumbers: d.orderNumbers,
    batchIndex: d.batchIndex,
    ordersPerList: d.ordersPerList,
    totalItemsQty: d.totalItemsQty,
    orderCount: d.orderCount,
    completedAt:
      d.completedAt instanceof Date
        ? d.completedAt.toISOString()
        : new Date(0).toISOString(),
    stopCount: Array.isArray(d.steps) ? d.steps.length : 0,
  }));
}

type InsertInput = {
  dayKey: string;
  orderNumbers: string[];
  batchIndex: number;
  ordersPerList: number;
  steps: PickStep[];
  assembly: OrderAssembly[];
  totalItemsQty: number;
  orderCount: number;
  /** >= 0; from walk open to Finish, capped in insert. */
  durationMs: number;
};

/**
 * Idempotent: if any order in the batch is already in a completed pick for this day, throws.
 * Returns the new `picklistUid` on success.
 */
export async function insertCompletedPicklist(
  input: InsertInput,
): Promise<string> {
  const { dayKey, orderNumbers, batchIndex, ordersPerList, steps, assembly } =
    input;
  const sorted = [...orderNumbers].sort((a, b) => a.localeCompare(b));
  if (sorted.length === 0) {
    throw new Error("orderNumbers is empty");
  }

  const client = await clientPromise;
  const db = client.db(kokobayDbName);
  const col = db.collection<Document>(COMPLETED_PICKLISTS_COLLECTION);

  await col.createIndex({ dayKey: 1, completedAt: -1 });
  await col.createIndex({ picklistUid: 1 }, { unique: true });
  await col.createIndex({ dayKey: 1, orderNumbers: 1 });

  const existing = await getCompletedOrderNumbersSetForDay(dayKey);
  for (const o of sorted) {
    if (existing.has(o)) {
      const err = new Error(
        "One or more orders in this batch are already completed for today",
      ) as Error & { code: string };
      err.code = "ALREADY_COMPLETED";
      throw err;
    }
  }

  const MAX_MS = 12 * 60 * 60 * 1000;
  const d = input.durationMs;
  const safeDuration =
    Number.isFinite(d) && d >= 0 ? Math.min(Math.floor(d), MAX_MS) : 0;

  const picklistUid = randomUUID();
  const doc: CompletedPicklistDoc = {
    picklistUid,
    dayKey,
    orderNumbers: sorted,
    batchIndex,
    ordersPerList: Math.floor(ordersPerList),
    steps: JSON.parse(JSON.stringify(steps)) as PickStep[],
    assembly: JSON.parse(JSON.stringify(assembly)) as OrderAssembly[],
    totalItemsQty: input.totalItemsQty,
    orderCount: input.orderCount,
    durationMs: safeDuration,
    completedAt: new Date(),
  };
  await col.insertOne(doc as unknown as Document);
  return picklistUid;
}

export async function deleteCompletedPicklistByUid(
  picklistUid: string,
): Promise<{ deleted: boolean }> {
  const client = await clientPromise;
  const db = client.db(kokobayDbName);
  const res = await db
    .collection(COMPLETED_PICKLISTS_COLLECTION)
    .deleteOne({ picklistUid: String(picklistUid) });
  return { deleted: res.deletedCount === 1 };
}
