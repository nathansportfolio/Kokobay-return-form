import { shopifyAdminGetNoCache, shopifyAdminPostNoCache } from "@/lib/shopifyAdminApi";
import { findShopifyOrderByQuery } from "@/lib/shopifyReturnOrderLookup";
import type { ShopifyOrder } from "@/types/shopify";

export type CreateShopifyRefundResult =
  | { ok: true; shopifyRefundId: number; orderId: string }
  | { ok: false; error: string; status?: number };

function asRecord(x: unknown): Record<string, unknown> | null {
  return x != null && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : null;
}

/**
 * Resolves REST `order.id` (digits) for Admin refund endpoints.
 */
export async function resolveShopifyOrderNumericIdForRefund(
  orderRef: string,
  shopifyOrderIdHint?: string | null,
): Promise<string | null> {
  const hint = shopifyOrderIdHint?.trim() ?? "";
  if (/^\d{10,}$/.test(hint)) {
    return hint;
  }
  const key = orderRef.trim();
  if (!key) return null;
  const order = await findShopifyOrderByQuery(key);
  if (!order?.id) return null;
  return String(order.id);
}

/**
 * Creates a **full** refund in Shopify (all line items, optional full shipping),
 * using `refunds/calculate` then `refunds.json`. Inventory: `no_restock` on lines.
 *
 * Call only from trusted server routes — this moves money.
 */
export async function createShopifyRefund(
  orderRef: string,
  shopifyOrderIdHint?: string | null,
): Promise<CreateShopifyRefundResult> {
  const orderId = await resolveShopifyOrderNumericIdForRefund(
    orderRef,
    shopifyOrderIdHint,
  );
  if (!orderId) {
    return {
      ok: false,
      error: "Could not resolve Shopify order id for refund",
    };
  }

  const ord = await shopifyAdminGetNoCache<{ order?: ShopifyOrder }>(
    `orders/${orderId}.json`,
  );
  if (!ord.ok || !ord.data.order) {
    return {
      ok: false,
      error: `Could not load order ${orderId} from Shopify`,
      status: ord.status,
    };
  }
  const order = ord.data.order;
  const currency = String(order.currency || "GBP").trim() || "GBP";
  const items = order.line_items.filter((li) => (li.quantity ?? 0) > 0);
  if (items.length === 0) {
    return { ok: false, error: "Order has no refundable line items" };
  }

  const refund_line_items = items.map((li) => ({
    line_item_id: li.id,
    quantity: Math.max(1, Math.trunc(Number(li.quantity) || 0)),
    restock_type: "no_restock" as const,
  }));

  const calculatePayload = {
    refund: {
      currency,
      refund_line_items,
      ...(order.shipping_lines?.length
        ? { shipping: { full_refund: true } }
        : {}),
    },
  };

  const calc = await shopifyAdminPostNoCache<{ refund?: unknown; errors?: unknown }>(
    `orders/${orderId}/refunds/calculate.json`,
    calculatePayload,
  );
  if (!calc.ok) {
    return {
      ok: false,
      error: `Shopify calculate failed: ${JSON.stringify(calc.data)}`,
      status: calc.status,
    };
  }
  const calcRefund = asRecord(calc.data.refund);
  const rawTx = calcRefund?.transactions;
  const txs = Array.isArray(rawTx) ? rawTx : [];
  const transactions = txs
    .map((t) => asRecord(t))
    .filter((t): t is Record<string, unknown> => t != null)
    .map((t) => {
      const parentId = Number(t.parent_id);
      const amtRaw = t.amount;
      const amount =
        typeof amtRaw === "number"
          ? amtRaw
          : Number.parseFloat(String(amtRaw ?? ""));
      const gateway = String(t.gateway ?? "").trim();
      return { parent_id: parentId, amount, gateway };
    })
    .filter(
      (t) =>
        Number.isFinite(t.parent_id) &&
        t.parent_id > 0 &&
        Number.isFinite(t.amount) &&
        t.amount > 0 &&
        t.gateway.length > 0,
    )
    .map((t) => ({
      parent_id: t.parent_id,
      amount: t.amount,
      kind: "refund" as const,
      gateway: t.gateway,
    }));

  if (transactions.length === 0) {
    return {
      ok: false,
      error:
        "Shopify returned no refundable transactions (order may already be fully refunded)",
    };
  }

  const createPayload = {
    refund: {
      currency,
      notify: false,
      note: "Warehouse refund (Kokobay)",
      refund_line_items,
      ...(order.shipping_lines?.length
        ? { shipping: { full_refund: true } }
        : {}),
      transactions,
    },
  };

  const created = await shopifyAdminPostNoCache<{
    refund?: { id?: number };
    errors?: unknown;
  }>(`orders/${orderId}/refunds.json`, createPayload);

  if (!created.ok) {
    return {
      ok: false,
      error: `Shopify refund create failed: ${JSON.stringify(created.data)}`,
      status: created.status,
    };
  }
  const rid = created.data.refund?.id;
  if (typeof rid !== "number" || !Number.isFinite(rid)) {
    return {
      ok: false,
      error: `Shopify refund response missing id: ${JSON.stringify(created.data)}`,
      status: created.status,
    };
  }
  return { ok: true, shopifyRefundId: Math.trunc(rid), orderId };
}
