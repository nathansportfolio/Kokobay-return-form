import { randomUUID } from "node:crypto";
import type { Document, Filter } from "mongodb";
import { getOrderRefLookupAliases } from "@/lib/orderRefAliases";
import {
  customerFormReasonLabel,
  isCustomerFormReturnReasonValue,
} from "@/lib/customerReturnFormReasons";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { returnReasonLabel } from "@/lib/returnReasons";
import { clampReturnLineNotes } from "@/lib/returnLineNotes";
import { normalizeShopifyOrderIdForStorage } from "@/lib/shopifyOrderAdminUrl";
import { dispositionCountsTowardCustomerRefund } from "@/lib/returnRefundDisposition";
import {
  normalizeReturnLineDisposition,
  type InsertReturnLogInput,
  type ReturnLogLineEntry,
  type ReturnLogListItem,
} from "@/lib/returnLogTypes";
import { insertReturnRefundLedgerEntry } from "@/lib/returnRefundLedger";
import type { SiteAccessRole } from "@/lib/siteAccess";

export const RETURN_LOGS_COLLECTION = "returnLogs";

export type { InsertReturnLogInput, ReturnLogLineEntry, ReturnLogListItem };

type ReturnLogMongo = {
  returnUid: string;
  orderRef: string;
  shopifyOrderId?: string;
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
  loggedByRole?: SiteAccessRole;
  loggedByOperator?: string;
  customerEmailMarkedByRole?: SiteAccessRole;
  customerEmailMarkedByOperator?: string;
  fullRefundMarkedByRole?: SiteAccessRole;
  fullRefundMarkedByOperator?: string;
};

function lineTotal(quantity: number, unit: number) {
  return Math.round(quantity * unit * 100) / 100;
}

function returnLogLineReasonLabel(reason: string | null): string {
  if (reason == null || reason === "") return "—";
  if (isCustomerFormReturnReasonValue(reason)) {
    return customerFormReasonLabel(reason);
  }
  return returnReasonLabel(reason);
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
  const shopifyOrderId = normalizeShopifyOrderIdForStorage(
    input.shopifyOrderId,
  );

  const lines: ReturnLogLineEntry[] = input.lines.map((l) => {
    const lt = lineTotal(l.quantity, l.unitPrice);
    const notesTrimmed = clampReturnLineNotes(l.notes ?? "");
    return {
      lineId: l.lineId,
      sku: l.sku,
      title: l.title,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      reason: l.reason,
      reasonLabel: returnLogLineReasonLabel(l.reason),
      disposition: normalizeReturnLineDisposition(l.disposition),
      lineTotalGbp: lt,
      ...(notesTrimmed ? { notes: notesTrimmed } : {}),
    };
  });

  const totalRefundGbp =
    Math.round(
      lines.reduce((s, l) => {
        if (!dispositionCountsTowardCustomerRefund(l.disposition)) return s;
        return s + l.lineTotalGbp;
      }, 0) * 100,
    ) / 100;

  const returnUid = randomUUID();
  const now = new Date();
  const doc: ReturnLogMongo = {
    returnUid,
    orderRef,
    ...(shopifyOrderId ? { shopifyOrderId } : {}),
    createdAt: now,
    lines,
    lineCount: lines.length,
    totalRefundGbp,
    customerEmailSent: false,
    fullRefundIssued: false,
    updatedAt: now,
    ...(input.loggedByRole ? { loggedByRole: input.loggedByRole } : {}),
    ...(input.loggedByOperator?.trim()
      ? { loggedByOperator: input.loggedByOperator.trim() }
      : {}),
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
  ...(d.shopifyOrderId ? { shopifyOrderId: d.shopifyOrderId } : {}),
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString(),
  lines: Array.isArray(d.lines)
    ? d.lines.map((l) => ({
        ...l,
        disposition: normalizeReturnLineDisposition(l.disposition),
      }))
    : [],
  lineCount: d.lineCount,
  totalRefundGbp: d.totalRefundGbp,
  customerEmailSent: d.customerEmailSent,
  ...(d.customerEmailSentAt
    ? { customerEmailSentAt: d.customerEmailSentAt.toISOString() }
    : {}),
  fullRefundIssued: d.fullRefundIssued,
  ...(typeof d.fullRefundAmountGbp === "number"
    ? { fullRefundAmountGbp: d.fullRefundAmountGbp }
    : {}),
  ...(d.fullRefundIssuedAt
    ? { fullRefundIssuedAt: d.fullRefundIssuedAt.toISOString() }
    : {}),
  ...(d.loggedByRole ? { loggedByRole: d.loggedByRole } : {}),
  ...(typeof d.loggedByOperator === "string" && d.loggedByOperator.trim()
    ? { loggedByOperator: d.loggedByOperator.trim() }
    : {}),
  ...(d.customerEmailMarkedByRole
    ? { customerEmailMarkedByRole: d.customerEmailMarkedByRole }
    : {}),
  ...(typeof d.customerEmailMarkedByOperator === "string" &&
  d.customerEmailMarkedByOperator.trim()
    ? { customerEmailMarkedByOperator: d.customerEmailMarkedByOperator.trim() }
    : {}),
  ...(d.fullRefundMarkedByRole
    ? { fullRefundMarkedByRole: d.fullRefundMarkedByRole }
    : {}),
  ...(typeof d.fullRefundMarkedByOperator === "string" &&
  d.fullRefundMarkedByOperator.trim()
    ? { fullRefundMarkedByOperator: d.fullRefundMarkedByOperator.trim() }
    : {}),
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

/** Counts logged returns where a full refund has not been recorded yet. */
export async function countReturnLogsPendingFullRefund(): Promise<number> {
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection<ReturnLogMongo>(RETURN_LOGS_COLLECTION);
  return col.countDocuments(
    { fullRefundIssued: false } as Filter<ReturnLogMongo>,
  );
}

export async function getReturnLogByUid(
  returnUid: string,
): Promise<ReturnLogMongo | null> {
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection<ReturnLogMongo>(RETURN_LOGS_COLLECTION);
  const doc = await col.findOne({ returnUid: String(returnUid) });
  if (!doc || !Array.isArray(doc.lines)) return doc;
  return {
    ...doc,
    lines: doc.lines.map((l) => ({
      ...l,
      disposition: normalizeReturnLineDisposition(l.disposition),
    })),
  };
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
  const aliases = getOrderRefLookupAliases(key);
  const orClause =
    aliases.length < 2
      ? { orderRef: { $regex: new RegExp(`^${escRegex(aliases[0] ?? key)}$`, "i") } }
      : {
          $or: aliases.map((a) => ({
            orderRef: { $regex: new RegExp(`^${escRegex(a)}$`, "i") },
          })),
        };
  const docs = await col
    .find(orClause)
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
  opts?: {
    markedByRole?: SiteAccessRole;
    markedByOperator?: string | null;
  },
): Promise<boolean> {
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection(RETURN_LOGS_COLLECTION);
  const now = new Date();
  const set: Record<string, unknown> = {
    customerEmailSent: true,
    customerEmailSentAt: now,
    updatedAt: now,
  };
  if (opts?.markedByRole) {
    set.customerEmailMarkedByRole = opts.markedByRole;
  }
  if (opts?.markedByOperator?.trim()) {
    set.customerEmailMarkedByOperator = opts.markedByOperator.trim();
  }
  const res = await col.updateOne({ returnUid: String(returnUid) }, { $set: set });
  return res.matchedCount === 1;
}

export async function markReturnFullRefund(
  returnUid: string,
  fullRefundAmountGbp: number,
  opts?: {
    markedByRole?: SiteAccessRole;
    markedByOperator?: string | null;
  },
): Promise<boolean> {
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection(RETURN_LOGS_COLLECTION);
  const uid = String(returnUid).trim();
  const prev = await col.findOne({ returnUid: uid });
  if (!prev) return false;

  const now = new Date();
  const amt = Math.round(Math.max(0, fullRefundAmountGbp) * 100) / 100;
  const wasAlreadyIssued = prev.fullRefundIssued === true;
  const set: Record<string, unknown> = {
    fullRefundIssued: true,
    fullRefundAmountGbp: amt,
    fullRefundIssuedAt: now,
    updatedAt: now,
  };
  if (opts?.markedByRole) {
    set.fullRefundMarkedByRole = opts.markedByRole;
  }
  if (opts?.markedByOperator?.trim()) {
    set.fullRefundMarkedByOperator = opts.markedByOperator.trim();
  }
  await col.updateOne({ returnUid: uid }, { $set: set });

  if (!wasAlreadyIssued) {
    await insertReturnRefundLedgerEntry({
      returnUid: uid,
      orderRef: String(prev.orderRef ?? "").trim() || "—",
      amountGbp: amt,
      recordedAt: now,
      markedByRole: opts?.markedByRole,
      markedByOperator: opts?.markedByOperator,
    });
  }

  return true;
}
