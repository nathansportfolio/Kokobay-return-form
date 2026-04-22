import { shopifyAdminGetNoCache } from "@/lib/shopifyAdminApi";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import type { OrderForPick } from "@/lib/fetchTodaysPickLists";
import { randomKokobayLocationForIndex } from "@/lib/kokobayLocationFormat";
import type { ShopifyLineItem, ShopifyOrder, ShopifyOrdersResponse } from "@/types/shopify";
import type { WarehouseOrderLine } from "@/lib/warehouseMockOrders";
import type { WarehouseProduct } from "@/lib/warehouseMockProducts";
import {
  WAREHOUSE_TZ,
  getWarehouseDayCreatedAtQueryBoundsUtc,
  isOrderOnWarehouseDay,
} from "@/lib/warehouseLondonDay";

const PICK_PAGE_LIM = 250;
const PICK_MAX_PAGES = 32;

/** Enrich pick lines with catalog fields only — not bin (mock below). */
type MongoBySku = Map<
  string,
  Pick<
    WarehouseProduct,
    "sku" | "name" | "unitPricePence" | "color" | "thumbnailImageUrl"
  >
>;

export function isShopifyWarehouseDataEnabled(): boolean {
  return Boolean(process.env.SHOPIFY_STORE?.trim());
}

async function loadMongoBySkus(skus: string[]): Promise<MongoBySku> {
  const m: MongoBySku = new Map();
  if (skus.length === 0) return m;
  const uniq = [...new Set(skus.map((s) => String(s).trim()).filter(Boolean))];
  try {
    const client = await clientPromise;
    const col = client
      .db(kokobayDbName)
      .collection<WarehouseProduct>("products");
    const docs = await col
      .find(
        { sku: { $in: uniq } },
        {
          projection: {
            sku: 1,
            name: 1,
            unitPricePence: 1,
            color: 1,
            thumbnailImageUrl: 1,
          },
        },
      )
      .toArray();
    for (const d of docs) {
      const sku = String(d.sku ?? "").trim();
      if (sku) m.set(sku, d);
    }
  } catch {
    /* Mongo optional */
  }
  return m;
}

function lineItemTitle(li: ShopifyLineItem): string {
  const t = (li.title ?? "").trim() || "Item";
  const vt = li.variant_title?.trim();
  if (!vt || vt === "Default Title") return t;
  return `${t} – ${vt}`;
}

/**
 * Placeholder bin / aisle code for the walk (not real WMS). Stable per
 * order+line so sorting does not shift between page loads in the 60s cache.
 */
function mockLocationForLine(order: ShopifyOrder, li: ShopifyLineItem): string {
  const oId = typeof order.id === "number" && Number.isFinite(order.id) ? order.id : 0;
  const liId = Number.isFinite(li.id) ? li.id : 0;
  const i = (oId * 1_000_000 + (liId % 1_000_000)) % 10_000_000;
  return randomKokobayLocationForIndex(i);
}

function shopifyOrderStatusLabel(o: ShopifyOrder): string {
  const fin = o.financial_status
    ? o.financial_status.replace(/_/g, " ")
    : "";
  const ful = o.fulfillment_status
    ? o.fulfillment_status.replace(/_/g, " ")
    : "unfulfilled";
  if (fin && ful) return `${fin} · ${ful}`;
  return fin || ful || "—";
}

function toWarehouseLines(
  o: ShopifyOrder,
  m: MongoBySku,
): WarehouseOrderLine[] {
  const withQty = o.line_items.filter((li) => (li.quantity ?? 0) > 0);
  return withQty.map((li) => {
    const sku = (li.sku && String(li.sku).trim()) || `V${li.variant_id}`;
    const location = mockLocationForLine(o, li);
    const row = m.get(sku);
    const pence = Math.max(
      0,
      Math.round(Number.parseFloat(String(li.price) || "0") * 100) || 0,
    );
    return {
      sku,
      quantity: Math.max(1, Math.trunc(Number(li.quantity) || 0)),
      name: row?.name?.trim() || lineItemTitle(li),
      color: row?.color?.trim(),
      thumbnailImageUrl: row?.thumbnailImageUrl?.trim() || undefined,
      location,
      unitPricePence: pence,
    } satisfies WarehouseOrderLine;
  });
}

/**
 * Requests orders whose `created_at` falls within the full warehouse `dayKey`
 * (London) via Shopify query params, paginating past 250 so “today’s” set is
 * not truncated to the store’s 250 most-recent. Lines and prices from Shopify;
 * bin location is mock. Optional Mongo `products` for display fields by SKU.
 */
export async function getTodaysShopifyOrderForPicks(
  dayKey: string,
): Promise<OrderForPick[]> {
  const { createdAtMin, createdAtMax } = getWarehouseDayCreatedAtQueryBoundsUtc(
    dayKey,
  );

  const inDay: ShopifyOrder[] = [];
  let lastId: number | undefined;
  for (let page = 0; page < PICK_MAX_PAGES; page += 1) {
    const q = new URLSearchParams();
    q.set("status", "any");
    q.set("order", "created_at asc");
    q.set("limit", String(PICK_PAGE_LIM));
    q.set("created_at_min", createdAtMin);
    q.set("created_at_max", createdAtMax);
    if (lastId != null) {
      q.set("since_id", String(lastId));
    }
    const path = `orders.json?${q.toString()}`;

    // Not `shopifyAdminGet` — Next data cache has a 2MB cap; a full day of
    // orders can exceed that and 500 the page.
    const { ok, data } = await shopifyAdminGetNoCache<ShopifyOrdersResponse>(
      path,
    );
    if (!ok) {
      if (inDay.length === 0) return [];
      break;
    }
    const pageOrders = data?.orders ?? [];
    for (const o of pageOrders) {
      const created = new Date(o.created_at);
      if (
        Number.isNaN(created.getTime()) ||
        !isOrderOnWarehouseDay(created, dayKey, WAREHOUSE_TZ)
      ) {
        continue;
      }
      const withQty =
        o.line_items?.filter((li) => (li.quantity ?? 0) > 0) ?? [];
      if (withQty.length === 0) continue;
      inDay.push(o);
    }
    if (pageOrders.length < PICK_PAGE_LIM) {
      break;
    }
    const last = pageOrders[pageOrders.length - 1];
    if (typeof last?.id !== "number" || !Number.isFinite(last.id)) {
      break;
    }
    lastId = last.id;
  }

  inDay.sort(
    (a, b) =>
      (a.order_number - b.order_number) ||
      String(a.id).localeCompare(String(b.id)),
  );

  const allSkus: string[] = [];
  for (const o of inDay) {
    for (const li of o.line_items) {
      if ((li.quantity ?? 0) <= 0) continue;
      allSkus.push(
        (li.sku && String(li.sku).trim()) || `V${li.variant_id}`,
      );
    }
  }
  const m = await loadMongoBySkus(allSkus);

  return inDay.map((o) => ({
    orderNumber: o.name,
    status: shopifyOrderStatusLabel(o),
    items: toWarehouseLines(o, m),
  }));
}
