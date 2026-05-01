import { DateTime } from "luxon";
import { shopifyAdminGetNoCache } from "@/lib/shopifyAdminApi";
import { lineItemTitle } from "@/lib/shopifyLineItemTitle";
import { WAREHOUSE_TZ } from "@/lib/warehouseLondonDay";
import type { ShopifyLineItem, ShopifyOrder, ShopifyOrdersResponse } from "@/types/shopify";

const PAGE_LIM = 250;
const MAX_PAGES = 40;

/** Yesterday 17:00 → today 08:30, wall-clock London (handles GMT/BST). */
export function getOvernightReportWindowBoundsUtc(): {
  createdAtMin: string;
  createdAtMax: string;
  labelFromLondon: string;
  labelToLondon: string;
} {
  const now = DateTime.now().setZone(WAREHOUSE_TZ);
  const todayKey = now.toFormat("yyyy-MM-dd");
  const yesterdayKey = now.minus({ days: 1 }).toFormat("yyyy-MM-dd");

  const startLondon = DateTime.fromISO(`${yesterdayKey}T17:00:00`, {
    zone: WAREHOUSE_TZ,
  });
  const endLondon = DateTime.fromISO(`${todayKey}T08:30:00`, {
    zone: WAREHOUSE_TZ,
  });

  const createdAtMin = startLondon.toUTC().toISO();
  const createdAtMax = endLondon.toUTC().toISO();
  if (!createdAtMin || !createdAtMax) {
    throw new Error("Could not compute overnight window bounds");
  }

  return {
    createdAtMin,
    createdAtMax,
    labelFromLondon: startLondon.toFormat("yyyy-MM-dd HH:mm"),
    labelToLondon: endLondon.toFormat("yyyy-MM-dd HH:mm"),
  };
}

function orderEmail(o: ShopifyOrder): string {
  const direct = String(o.email ?? "").trim();
  if (direct) return direct;
  const c = o.customer;
  if (c) return String(c.email ?? "").trim();
  return "";
}

function formatCreatedLondon(iso: string): string {
  const dt = DateTime.fromISO(iso, { zone: "utc" }).setZone(WAREHOUSE_TZ);
  if (!dt.isValid) return iso;
  return dt.toFormat("yyyy-MM-dd HH:mm:ss ZZZZ");
}

export type OvernightOrderReportEntry = {
  email: string;
  orderName: string;
  shopifyOrderId: number;
  createdAtUtc: string;
  createdAtLondon: string;
  items: {
    title: string;
    quantity: number;
    sku: string | null;
  }[];
};

/**
 * Orders with `created_at` in [yesterday 17:00 London, today 08:30 London], paginated.
 */
export async function fetchOvernightWindowOrders(): Promise<ShopifyOrder[]> {
  const { createdAtMin, createdAtMax } = getOvernightReportWindowBoundsUtc();

  const acc: ShopifyOrder[] = [];
  let lastId: number | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const q = new URLSearchParams();
    q.set("status", "any");
    q.set("order", "created_at asc");
    q.set("limit", String(PAGE_LIM));
    q.set("created_at_min", createdAtMin);
    q.set("created_at_max", createdAtMax);
    if (lastId != null) q.set("since_id", String(lastId));

    const path = `orders.json?${q.toString()}`;
    const { ok, data } = await shopifyAdminGetNoCache<ShopifyOrdersResponse>(
      path,
    );
    if (!ok) break;

    const pageOrders = data?.orders ?? [];
    for (const o of pageOrders) {
      const withQty =
        o.line_items?.filter((li) => (li.quantity ?? 0) > 0) ?? [];
      if (withQty.length === 0) continue;
      acc.push(o);
    }

    if (pageOrders.length < PAGE_LIM) break;
    const last = pageOrders[pageOrders.length - 1];
    if (typeof last?.id !== "number" || !Number.isFinite(last.id)) break;
    lastId = last.id;
  }

  return acc;
}

export function toOvernightReportEntries(
  orders: ShopifyOrder[],
): OvernightOrderReportEntry[] {
  return orders.map((o) => ({
    email: orderEmail(o),
    orderName: o.name,
    shopifyOrderId: o.id,
    createdAtUtc: o.created_at,
    createdAtLondon: formatCreatedLondon(o.created_at),
    items: (o.line_items ?? [])
      .filter((li: ShopifyLineItem) => (li.quantity ?? 0) > 0)
      .map((li: ShopifyLineItem) => ({
        title: lineItemTitle(li),
        quantity: Math.max(1, Math.trunc(Number(li.quantity) || 0)),
        sku: li.sku != null && String(li.sku).trim() ? String(li.sku).trim() : null,
      })),
  }));
}
