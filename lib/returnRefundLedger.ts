import { randomUUID } from "node:crypto";
import type { Document } from "mongodb";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import type { SiteAccessRole } from "@/lib/siteAccess";
import { getWarehouseDayCreatedAtQueryBoundsUtc } from "@/lib/warehouseLondonDay";

/** One row per return when “full refund issued” is first recorded in the app. */
export const RETURN_REFUND_LEDGER_COLLECTION = "returnRefundLedger";

type ReturnRefundLedgerMongo = {
  ledgerUid: string;
  returnUid: string;
  orderRef: string;
  amountGbp: number;
  recordedAt: Date;
  fullRefundMarkedByRole?: SiteAccessRole;
  fullRefundMarkedByOperator?: string;
};

let indexesEnsured = false;

async function ensureReturnRefundLedgerIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection(RETURN_REFUND_LEDGER_COLLECTION);
  await col.createIndex({ returnUid: 1 }, { unique: true });
  await col.createIndex({ recordedAt: -1 });
  indexesEnsured = true;
}

/**
 * Append a ledger row when a return is first marked refunded. Idempotent per
 * `returnUid` (unique index); duplicate inserts are ignored.
 */
export async function insertReturnRefundLedgerEntry(input: {
  returnUid: string;
  orderRef: string;
  amountGbp: number;
  recordedAt: Date;
  markedByRole?: SiteAccessRole;
  markedByOperator?: string | null;
}): Promise<void> {
  await ensureReturnRefundLedgerIndexes();
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection(RETURN_REFUND_LEDGER_COLLECTION);

  const orderRef = String(input.orderRef ?? "").trim() || "—";
  const amt = Math.round(Math.max(0, input.amountGbp) * 100) / 100;
  const doc: ReturnRefundLedgerMongo = {
    ledgerUid: randomUUID(),
    returnUid: String(input.returnUid).trim(),
    orderRef,
    amountGbp: amt,
    recordedAt: input.recordedAt,
    ...(input.markedByRole ? { fullRefundMarkedByRole: input.markedByRole } : {}),
    ...(input.markedByOperator?.trim()
      ? { fullRefundMarkedByOperator: input.markedByOperator.trim() }
      : {}),
  };

  try {
    await col.insertOne(doc as unknown as Document);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: number }).code === 11000
    ) {
      return;
    }
    throw e;
  }
}

/**
 * Sum `amountGbp` for in-app “full refund issued” marks on the given London calendar day.
 */
export async function sumRecordedRefundsGbpForLondonCalendarDay(
  dayKey: string,
): Promise<number> {
  await ensureReturnRefundLedgerIndexes();
  const { createdAtMin, createdAtMax } =
    getWarehouseDayCreatedAtQueryBoundsUtc(dayKey);
  const min = new Date(createdAtMin);
  const max = new Date(createdAtMax);
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection<ReturnRefundLedgerMongo>(RETURN_REFUND_LEDGER_COLLECTION);

  const rows = await col
    .aggregate<{ total: number }>([
      { $match: { recordedAt: { $gte: min, $lte: max } } },
      { $group: { _id: null, total: { $sum: "$amountGbp" } } },
    ])
    .toArray();
  const raw = rows[0]?.total ?? 0;
  return Math.round(Number(raw) * 100) / 100;
}

