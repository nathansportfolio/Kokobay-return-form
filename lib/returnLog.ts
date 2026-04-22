import { randomUUID } from "node:crypto";
import type { Document, Filter } from "mongodb";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { returnReasonLabel } from "@/lib/returnReasons";
import type {
  InsertReturnLogInput,
  ReturnLogLineEntry,
  ReturnLogListItem,
} from "@/lib/returnLogTypes";

export const RETURN_LOGS_COLLECTION = "returnLogs";

export type { InsertReturnLogInput, ReturnLogLineEntry, ReturnLogListItem };

type ReturnLogMongo = {
  returnUid: string;
  orderRef: string;
  createdAt: Date;
  lines: ReturnLogLineEntry[];
  lineCount: number;
  totalRefundGbp: number;
  customerEmailSent: boolean;
  customerEmailSentAt?: Date;
  fullRefundIssued: boolean;
  fullRefundAmountGbp?: number;
  fullRefundIssuedAt?: Date;
  updatedAt: Date;
};

function lineTotal(quantity: number, unit: number) {
  return Math.round(quantity * unit * 100) / 100;
}

export async function insertReturnLog(
  input: InsertReturnLogInput,
): Promise<string> {
  if (!input.lines.length) {
    throw new Error("At least one line is required");
  }
  const orderRef = String(input.orderRef ?? "").trim();
  if (!orderRef) {
    throw new Error("orderRef is required");
  }

  const lines: ReturnLogLineEntry[] = input.lines.map((l) => {
    const lt = lineTotal(l.quantity, l.unitPrice);
    return {
      lineId: l.lineId,
      sku: l.sku,
      title: l.title,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      reason: l.reason,
      reasonLabel: returnReasonLabel(l.reason),
      disposition: l.disposition,
      lineTotalGbp: lt,
    };
  });

  const totalRefundGbp =
    Math.round(lines.reduce((s, l) => s + l.lineTotalGbp, 0) * 100) / 100;

  const returnUid = randomUUID();
  const now = new Date();
  const doc: ReturnLogMongo = {
    returnUid,
    orderRef,
    createdAt: now,
    lines,
    lineCount: lines.length,
    totalRefundGbp,
    customerEmailSent: false,
    fullRefundIssued: false,
    updatedAt: now,
  };

  const client = await clientPromise;
  const db = client.db(kokobayDbName);
  const col = db.collection(RETURN_LOGS_COLLECTION);
  await col.createIndex({ returnUid: 1 }, { unique: true });
  await col.createIndex({ orderRef: 1, createdAt: -1 });
  await col.createIndex({ createdAt: -1 });
  await col.insertOne(doc as unknown as Document);

  return returnUid;
}

export type ReturnLogListSort = "date" | "email" | "refund";
export type ReturnLogListOrder = "asc" | "desc";

const mapDocToListItem = (d: ReturnLogMongo): ReturnLogListItem => ({
  returnUid: d.returnUid,
  orderRef: d.orderRef,
  createdAt: d.createdAt.toISOString(),
  lineCount: d.lineCount,
  totalRefundGbp: d.totalRefundGbp,
  customerEmailSent: d.customerEmailSent,
  fullRefundIssued: d.fullRefundIssued,
});

/**
 * Build Mongo sort. Tie-breaks with `createdAt` then `returnUid` for stable order.
 */
function returnLogsSort(
  sort: ReturnLogListSort,
  order: ReturnLogListOrder,
): Record<string, 1 | -1> {
  const d: 1 | -1 = order === "asc" ? 1 : -1;
  if (sort === "date") {
    return { createdAt: d, returnUid: d };
  }
  if (sort === "email") {
    return { customerEmailSent: d, createdAt: -1, returnUid: -1 };
  }
  return { fullRefundIssued: d, createdAt: -1, returnUid: -1 };
}

export type ListReturnLogsPagedInput = {
  page: number;
  pageSize: number;
  sort: ReturnLogListSort;
  order: ReturnLogListOrder;
  /** Inclusive on `createdAt` (UTC) when set; `null` means all time. */
  createdAtRange: { gte: Date; lte: Date } | null;
  /** If true, only rows where a full refund has not been recorded yet. */
  refundPendingOnly: boolean;
};

/**
 * Paged, sorted return log list for the warehouse /returns/logged view.
 * Returns the effective `page` (clamped) after counting total documents.
 */
export async function listReturnLogsPaged(
  input: ListReturnLogsPagedInput,
): Promise<{
  items: ReturnLogListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const pageSize = Math.min(100, Math.max(1, Math.floor(input.pageSize) || 25));
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection<ReturnLogMongo>(RETURN_LOGS_COLLECTION);

  const q: Filter<ReturnLogMongo> = {};
  if (input.createdAtRange !== null) {
    q.createdAt = {
      $gte: input.createdAtRange.gte,
      $lte: input.createdAtRange.lte,
    };
  }
  if (input.refundPendingOnly) {
    q.fullRefundIssued = false;
  }

  const total = await col.countDocuments(q);

  const maxPage = Math.max(1, Math.ceil(total / pageSize) || 1);
  const page = Math.min(Math.max(1, input.page), maxPage);
  const skip = (page - 1) * pageSize;

  const docs = await col
    .find(q)
    .sort(returnLogsSort(input.sort, input.order))
    .skip(skip)
    .limit(pageSize)
    .toArray();

  return {
    items: docs.map(mapDocToListItem),
    total,
    page,
    pageSize,
  };
}

export async function getReturnLogByUid(
  returnUid: string,
): Promise<ReturnLogMongo | null> {
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection<ReturnLogMongo>(RETURN_LOGS_COLLECTION);
  return col.findOne({ returnUid: String(returnUid) });
}

/** Most recent return log for this order reference (trimmed, case-insensitive on stored value). */
export async function getLatestReturnLogForOrder(
  orderRef: string,
): Promise<ReturnLogMongo | null> {
  const key = orderRef.trim();
  if (!key) return null;
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection<ReturnLogMongo>(RETURN_LOGS_COLLECTION);
  const docs = await col
    .find({ orderRef: { $regex: new RegExp(`^${escRegex(key)}$`, "i") } })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();
  return docs[0] ?? null;
}

function escRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function markReturnCustomerEmailSent(
  returnUid: string,
): Promise<boolean> {
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection(RETURN_LOGS_COLLECTION);
  const now = new Date();
  const res = await col.updateOne(
    { returnUid: String(returnUid) },
    {
      $set: { customerEmailSent: true, customerEmailSentAt: now, updatedAt: now },
    },
  );
  return res.matchedCount === 1;
}

export async function markReturnFullRefund(
  returnUid: string,
  fullRefundAmountGbp: number,
): Promise<boolean> {
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection(RETURN_LOGS_COLLECTION);
  const now = new Date();
  const amt = Math.max(0, fullRefundAmountGbp);
  const res = await col.updateOne(
    { returnUid: String(returnUid) },
    {
      $set: {
        fullRefundIssued: true,
        fullRefundAmountGbp: amt,
        fullRefundIssuedAt: now,
        updatedAt: now,
      },
    },
  );
  return res.matchedCount === 1;
}
