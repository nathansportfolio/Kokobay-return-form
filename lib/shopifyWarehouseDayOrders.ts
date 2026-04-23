import { shopifyAdminGetNoCache } from "@/lib/shopifyAdminApi";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { ensureProductCatalogSyncedForWarehouseDay } from "@/lib/shopifyProductCatalog";
import type { OrderForPick } from "@/lib/fetchTodaysPickLists";
import { randomKokobayLocationForIndex } from "@/lib/kokobayLocationFormat";
import { displaySkuForShopifyLineItem } from "@/lib/shopifyLineItemSku";
import { lineItemTitle } from "@/lib/shopifyLineItemTitle";
import type { ShopifyLineItem, ShopifyOrder, ShopifyOrdersResponse } from "@/types/shopify";
import type { WarehouseOrderLine } from "@/lib/warehouseMockOrders";
import type { WarehouseProduct } from "@/lib/warehouseMockProducts";
import { loadBinCodeByVariantId } from "@/lib/loadBinCodeByVariantId";
import {
  WAREHOUSE_TZ,
  getTodayCalendarDateKeyInLondon,
  getWarehouseDayCreatedAtQueryBoundsUtc,
  isOrderOnWarehouseDay,
} from "@/lib/warehouseLondonDay";
import { UK_PREMIUM_NDD_LINE_TITLE } from "@/lib/shopifyShippingLineTitles";
import { DateTime } from "luxon";

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

/**
 * Placeholder bin / aisle code for the walk (not real WMS). Stable per
 * order+line so sorting does not shift between page loads in the 60s cache.
 * Same `RACK-BAY-LEVEL` shape as `POST /api/bins` / `stock.binCode` when present.
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
  binByVariantId: Map<number, string>,
): WarehouseOrderLine[] {
  const withQty = o.line_items.filter((li) => (li.quantity ?? 0) > 0);
  return withQty.map((li) => {
    const sku = displaySkuForShopifyLineItem(li);
    const vid = Number(li.variant_id);
    const fromStock =
      Number.isFinite(vid) && binByVariantId.get(vid)?.trim();
    const location = fromStock || mockLocationForLine(o, li);
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
      requiresShipping: li.requires_shipping,
    } satisfies WarehouseOrderLine;
  });
}

/**
 * All Shopify orders whose `created_at` falls in the full London `dayKey`
 * window (one calendar day, paginated).
 */
export async function getShopifyOrdersInWarehouseDay(
  dayKey: string,
): Promise<ShopifyOrder[]> {
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
  return inDay;
}

function normShipTitle(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function orderHasShippingLineTitle(
  o: ShopifyOrder,
  exactTitle: string,
): boolean {
  const w = normShipTitle(exactTitle);
  for (const sl of o.shipping_lines ?? []) {
    const t = (sl as { title?: string }).title;
    if (normShipTitle(String(t ?? "")) === w) {
      return true;
    }
  }
  return false;
}

/**
 * `created` must be on the same London `dayKey` and before 14:00:00.000
 * (warehouse wall clock) — for “ordered before 2pm same day”.
 */
export function orderPlacedInLondonOnDayBefore14(
  created: Date,
  dayKey: string,
): boolean {
  if (Number.isNaN(created.getTime())) return false;
  const d = DateTime.fromJSDate(created, { zone: "utc" }).setZone(
    WAREHOUSE_TZ,
  );
  if (d.toFormat("yyyy-MM-dd") !== dayKey) return false;
  const h14 = d.startOf("day").set({ hour: 14, minute: 0, second: 0, millisecond: 0 });
  return d < h14;
}

/**
 * “Next day / UK premium” set: `UK Premium Delivery (1-2 working days)`,
 * order placed the **same** London day **strictly before** 14:00.
 */
export async function getUkPremiumShopifyOrdersForPicks(): Promise<
  OrderForPick[]
> {
  const client = await clientPromise;
  await ensureProductCatalogSyncedForWarehouseDay(
    client.db(kokobayDbName),
  );

  const dayKey = getTodayCalendarDateKeyInLondon();
  const raw = await getShopifyOrdersInWarehouseDay(dayKey);
  const filtered = raw.filter(
    (o) =>
      orderPlacedInLondonOnDayBefore14(new Date(o.created_at), dayKey) &&
      orderHasShippingLineTitle(o, UK_PREMIUM_NDD_LINE_TITLE),
  );

  const allSkus: string[] = [];
  const allVariantIds: number[] = [];
  for (const o of filtered) {
    for (const li of o.line_items) {
      if ((li.quantity ?? 0) <= 0) continue;
      allSkus.push(displaySkuForShopifyLineItem(li));
      const v = li.variant_id;
      if (typeof v === "number" && Number.isFinite(v)) {
        allVariantIds.push(v);
      }
    }
  }
  const [m, binByVariantId] = await Promise.all([
    loadMongoBySkus(allSkus),
    loadBinCodeByVariantId(allVariantIds),
  ]);

  return filtered.map((o) => ({
    orderNumber: o.name,
    status: shopifyOrderStatusLabel(o),
    items: toWarehouseLines(o, m, binByVariantId),
  }));
}

/**
 * Requests orders whose `created_at` falls within the full warehouse `dayKey`
 * (London) via Shopify query params, paginating past 250 so “today’s” set is
 * not truncated to the store’s 250 most-recent. Lines and prices from Shopify;
 * `stock.binCode` when the variant is present in Mongo `stock` (from
 * `POST /api/stock/seed`); else mock location. Optional `products` for
 * display fields by SKU.
 */
export async function getTodaysShopifyOrderForPicks(
  dayKey: string,
): Promise<OrderForPick[]> {
  const client = await clientPromise;
  await ensureProductCatalogSyncedForWarehouseDay(
    client.db(kokobayDbName),
  );
  const inDay = await getShopifyOrdersInWarehouseDay(dayKey);
  if (inDay.length === 0) return [];

  const allSkus: string[] = [];
  const allVariantIds: number[] = [];
  for (const o of inDay) {
    for (const li of o.line_items) {
      if ((li.quantity ?? 0) <= 0) continue;
      allSkus.push(displaySkuForShopifyLineItem(li));
      const v = li.variant_id;
      if (typeof v === "number" && Number.isFinite(v)) {
        allVariantIds.push(v);
      }
    }
  }
  const [m, binByVariantId] = await Promise.all([
    loadMongoBySkus(allSkus),
    loadBinCodeByVariantId(allVariantIds),
  ]);

  return inDay.map((o) => ({
    orderNumber: o.name,
    status: shopifyOrderStatusLabel(o),
    items: toWarehouseLines(o, m, binByVariantId),
  }));
}
