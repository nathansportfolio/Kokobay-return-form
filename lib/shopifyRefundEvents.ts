import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { getWarehouseDayCreatedAtQueryBoundsUtc } from "@/lib/warehouseLondonDay";

/** One row per Shopify Admin refund (`refunds/create` webhook). */
export const SHOPIFY_REFUND_EVENTS_COLLECTION = "shopifyRefundEvents";

export type ShopifyRefundEventMongo = {
  shopifyRefundId: number;
  shopifyOrderId: number;
  /** Shopify `Refund.created_at` — when the refund was created in Admin (wall-clock instant). */
  refundCreatedAt: Date;
  /** Sum from successful `refund` transactions in shop currency, or line-item fallback. */
  amountShop: number;
  shopCurrency: string;
  webhookReceivedAt: Date;
};

let indexesEnsured = false;

async function ensureShopifyRefundEventIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection(SHOPIFY_REFUND_EVENTS_COLLECTION);
  await col.createIndex({ shopifyRefundId: 1 }, { unique: true });
  await col.createIndex({ refundCreatedAt: -1 });
  indexesEnsured = true;
}

function asRecord(x: unknown): Record<string, unknown> | null {
  if (x && typeof x === "object" && !Array.isArray(x)) {
    return x as Record<string, unknown>;
  }
  return null;
}

/** Webhook body is the Refund resource, or `{ refund: { ... } }`. */
export function extractRefundFromWebhookBody(body: unknown): Record<string, unknown> | null {
  const root = asRecord(body);
  if (!root) return null;
  const nested = asRecord(root.refund);
  if (nested) return nested;
  const id = Number(root.id);
  if (!Number.isFinite(id) || id < 1) return null;
  return root;
}

function moneyFromSet(
  set: unknown,
): { amount: number; currency: string } | null {
  const o = asRecord(set);
  if (!o) return null;
  const shop = asRecord(o.shop_money);
  const pres = asRecord(o.presentment_money);
  const pick = shop ?? pres;
  if (!pick) return null;
  const n = parseFloat(String(pick.amount ?? ""));
  if (!Number.isFinite(n)) return null;
  const currency =
    String(pick.currency_code ?? "").trim().toUpperCase() || "GBP";
  return { amount: n, currency };
}

/**
 * Prefer successful `kind: refund` transactions; otherwise line items + shipping (shop money).
 */
export function refundAmountShopMoney(refund: Record<string, unknown>): {
  amount: number;
  currency: string;
} {
  let amount = 0;
  let currency = "GBP";

  const trans = refund.transactions;
  if (Array.isArray(trans)) {
    for (const t of trans) {
      const tx = asRecord(t);
      if (!tx) continue;
      if (String(tx.status ?? "").toLowerCase() !== "success") continue;
      if (String(tx.kind ?? "").toLowerCase() !== "refund") continue;
      const fromSet = moneyFromSet(tx.amount_set);
      if (fromSet) {
        amount += fromSet.amount;
        if (fromSet.currency) currency = fromSet.currency;
        continue;
      }
      const n = parseFloat(String(tx.amount ?? "0"));
      if (Number.isFinite(n)) amount += n;
      const c = String(tx.currency ?? "").trim().toUpperCase();
      if (c) currency = c;
    }
  }

  if (amount > 0) {
    return { amount: Math.round(amount * 100) / 100, currency };
  }

  amount = 0;
  const items = refund.refund_line_items;
  if (Array.isArray(items)) {
    for (const li of items) {
      const row = asRecord(li);
      if (!row) continue;
      const sub = moneyFromSet(row.subtotal_set);
      if (sub) {
        amount += sub.amount;
        currency = sub.currency || currency;
      } else {
        const n = parseFloat(String(row.subtotal ?? "0"));
        if (Number.isFinite(n)) amount += n;
      }
      const tax = moneyFromSet(row.total_tax_set);
      if (tax) amount += tax.amount;
    }
  }

  const shipLines = refund.refund_shipping_lines;
  if (Array.isArray(shipLines)) {
    for (const sl of shipLines) {
      const row = asRecord(sl);
      if (!row) continue;
      const sub = moneyFromSet(row.subtotal_amount_set);
      if (sub) amount += sub.amount;
    }
  }

  return { amount: Math.round(amount * 100) / 100, currency };
}

export async function insertShopifyRefundEventFromWebhook(
  body: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const refund = extractRefundFromWebhookBody(body);
  if (!refund) {
    return { ok: false, error: "Unrecognised refund payload" };
  }

  const shopifyRefundId = Math.trunc(Number(refund.id));
  let shopifyOrderId = Math.trunc(Number(refund.order_id));
  if (!Number.isFinite(shopifyOrderId) || shopifyOrderId < 1) {
    const ord = asRecord(refund.order);
    if (ord) shopifyOrderId = Math.trunc(Number(ord.id));
  }
  if (!Number.isFinite(shopifyRefundId) || shopifyRefundId < 1) {
    return { ok: false, error: "Missing refund id" };
  }
  if (!Number.isFinite(shopifyOrderId) || shopifyOrderId < 1) {
    return { ok: false, error: "Missing order id" };
  }

  const createdRaw = refund.created_at;
  const refundCreatedAt =
    typeof createdRaw === "string" || createdRaw instanceof Date
      ? new Date(createdRaw as string | Date)
      : null;
  if (!refundCreatedAt || Number.isNaN(refundCreatedAt.getTime())) {
    return { ok: false, error: "Missing refund created_at" };
  }

  const { amount, currency } = refundAmountShopMoney(refund);
  const now = new Date();

  await ensureShopifyRefundEventIndexes();
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection<ShopifyRefundEventMongo>(SHOPIFY_REFUND_EVENTS_COLLECTION);

  const doc: ShopifyRefundEventMongo = {
    shopifyRefundId,
    shopifyOrderId,
    refundCreatedAt,
    amountShop: amount,
    shopCurrency: currency,
    webhookReceivedAt: now,
  };

  try {
    await col.insertOne(doc);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: number }).code === 11000
    ) {
      return { ok: true };
    }
    throw e;
  }
  return { ok: true };
}

/**
 * Sum `amountShop` for refunds whose **Shopify** `created_at` falls on the given
 * London calendar day. Only rows in **GBP** (or missing currency treated as GBP)
 * are summed so the dashboard matches UK formatting.
 */
export async function sumShopifyRefundAmountsGbpForLondonCalendarDay(
  dayKey: string,
): Promise<number> {
  await ensureShopifyRefundEventIndexes();
  const { createdAtMin, createdAtMax } =
    getWarehouseDayCreatedAtQueryBoundsUtc(dayKey);
  const min = new Date(createdAtMin);
  const max = new Date(createdAtMax);
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection<ShopifyRefundEventMongo>(SHOPIFY_REFUND_EVENTS_COLLECTION);

  const rows = await col
    .aggregate<{ total: number }>([
      {
        $match: {
          refundCreatedAt: { $gte: min, $lte: max },
          $or: [
            { shopCurrency: "GBP" },
            { shopCurrency: { $exists: false } },
            { shopCurrency: "" },
          ],
        },
      },
      { $group: { _id: null, total: { $sum: "$amountShop" } } },
    ])
    .toArray();
  const raw = rows[0]?.total ?? 0;
  return Math.round(Number(raw) * 100) / 100;
}
