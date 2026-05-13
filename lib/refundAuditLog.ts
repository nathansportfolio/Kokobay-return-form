import type { Document } from "mongodb";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import {
  getTodayCalendarDateKeyInLondon,
  getWarehouseDayCreatedAtQueryBoundsUtc,
} from "@/lib/warehouseLondonDay";

export const REFUND_AUDIT_LOGS_COLLECTION = "refundAuditLogs";

export type RefundAuditSource = "shopify_refund_button";

/**
 * Internal audit row: one document per staff “Refund in Shopify” action (after our
 * API accepts the request). Not used for eligibility, filtering, or return status.
 */
export type RefundAuditLog = {
  createdAt: Date;
  orderRef: string;
  customerName?: string | null;
  customerEmail?: string | null;
  refundAmount?: number | null;
  currency?: string | null;
  /** {@link ReturnLogMongo.returnUid} when known. */
  returnLogId?: string | null;
  /** Warehouse operator label from PIN session, when present. */
  refundedBy?: string | null;
  source: RefundAuditSource;
  shopifyOrderId?: number | null;
  notes?: string | null;
};

export type RefundAuditLogInsertInput = Omit<RefundAuditLog, "createdAt"> & {
  createdAt?: Date;
};

let indexesEnsured = false;

async function ensureRefundAuditLogIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const client = await clientPromise;
  const col = client.db(kokobayDbName).collection(REFUND_AUDIT_LOGS_COLLECTION);
  await col.createIndex({ createdAt: -1 });
  await col.createIndex({ orderRef: 1 });
  await col.createIndex({ customerEmail: 1 });
  indexesEnsured = true;
}

/**
 * Append one immutable audit row. Never updates existing documents.
 */
export async function insertRefundAuditLog(
  input: RefundAuditLogInsertInput,
): Promise<void> {
  await ensureRefundAuditLogIndexes();
  const orderRef = String(input.orderRef ?? "").trim();
  if (!orderRef) {
    throw new Error("orderRef is required");
  }
  const refundAmount =
    typeof input.refundAmount === "number" && Number.isFinite(input.refundAmount)
      ? Math.round(Math.max(0, input.refundAmount) * 100) / 100
      : null;
  let shopifyOrderId: number | null = null;
  if (typeof input.shopifyOrderId === "number" && Number.isFinite(input.shopifyOrderId)) {
    shopifyOrderId = Math.trunc(input.shopifyOrderId);
  }
  const doc: RefundAuditLog = {
    createdAt: input.createdAt ?? new Date(),
    orderRef,
    customerName:
      input.customerName == null || input.customerName === ""
        ? null
        : String(input.customerName).trim() || null,
    customerEmail:
      input.customerEmail == null || String(input.customerEmail).trim() === ""
        ? null
        : String(input.customerEmail).trim(),
    refundAmount,
    currency:
      input.currency == null || String(input.currency).trim() === ""
        ? "GBP"
        : String(input.currency).trim(),
    returnLogId:
      input.returnLogId == null || String(input.returnLogId).trim() === ""
        ? null
        : String(input.returnLogId).trim(),
    refundedBy:
      input.refundedBy == null || String(input.refundedBy).trim() === ""
        ? null
        : String(input.refundedBy).trim(),
    source: input.source,
    shopifyOrderId,
    notes:
      input.notes == null || String(input.notes).trim() === ""
        ? null
        : String(input.notes).trim(),
  };
  const client = await clientPromise;
  await client
    .db(kokobayDbName)
    .collection(REFUND_AUDIT_LOGS_COLLECTION)
    .insertOne(doc as unknown as Document);
}

export type RefundsTodayStats = {
  count: number;
  totalAmount: number;
  customers: number;
  refunds: RefundAuditLog[];
};

function numish(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.trunc(v);
  }
  if (v != null && typeof (v as { toString?: () => string }).toString === "function") {
    const n = Number(String(v));
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function mapDocToRefundAuditLog(d: Record<string, unknown>): RefundAuditLog {
  const src = String(d.source ?? "shopify_refund_button");
  return {
    createdAt: d.createdAt instanceof Date ? d.createdAt : new Date(String(d.createdAt)),
    orderRef: String(d.orderRef ?? ""),
    customerName:
      d.customerName == null ? null : String(d.customerName),
    customerEmail:
      d.customerEmail == null ? null : String(d.customerEmail),
    refundAmount:
      typeof d.refundAmount === "number" && Number.isFinite(d.refundAmount)
        ? d.refundAmount
        : null,
    currency: d.currency == null ? null : String(d.currency),
    returnLogId: d.returnLogId == null ? null : String(d.returnLogId),
    refundedBy: d.refundedBy == null ? null : String(d.refundedBy),
    source: (src === "shopify_refund_button" ? src : "shopify_refund_button") as RefundAuditSource,
    shopifyOrderId: numish(d.shopifyOrderId),
    notes: d.notes == null ? null : String(d.notes),
  };
}

/**
 * London “today” window for `createdAt`. Analytics / dashboard only — not used for
 * return eligibility or list filtering.
 */
export async function countRefundsToday(): Promise<RefundsTodayStats> {
  await ensureRefundAuditLogIndexes();
  const dayKey = getTodayCalendarDateKeyInLondon();
  const { createdAtMin, createdAtMax } = getWarehouseDayCreatedAtQueryBoundsUtc(dayKey);
  const min = new Date(createdAtMin);
  const max = new Date(createdAtMax);
  const client = await clientPromise;
  const col = client.db(kokobayDbName).collection(REFUND_AUDIT_LOGS_COLLECTION);

  const rows = await col
    .aggregate<{
      meta: { count: number; totalAmount: number }[];
      distinctEmails: { n: number }[];
      refunds: Record<string, unknown>[];
    }>([
      {
        $match: {
          createdAt: { $gte: min, $lte: max },
          source: "shopify_refund_button",
        },
      },
      {
        $facet: {
          meta: [
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalAmount: {
                  $sum: { $ifNull: ["$refundAmount", 0] },
                },
              },
            },
          ],
          distinctEmails: [
            {
              $match: {
                customerEmail: { $regex: /\S/ },
              },
            },
            { $group: { _id: "$customerEmail" } },
            { $count: "n" },
          ],
          refunds: [{ $sort: { createdAt: -1 } }, { $limit: 500 }],
        },
      },
    ])
    .toArray();

  const bucket = rows[0];
  const meta = bucket?.meta?.[0];
  const count = Math.max(0, Math.trunc(Number(meta?.count ?? 0)));
  const rawTotal = Number(meta?.totalAmount ?? 0);
  const totalAmount = Number.isFinite(rawTotal)
    ? Math.round(rawTotal * 100) / 100
    : 0;
  const customers = Math.max(
    0,
    Math.trunc(Number(bucket?.distinctEmails?.[0]?.n ?? 0)),
  );
  const refundDocs = Array.isArray(bucket?.refunds) ? bucket.refunds : [];
  const refunds = refundDocs.map((d) => mapDocToRefundAuditLog(d));

  return { count, totalAmount, customers, refunds };
}
