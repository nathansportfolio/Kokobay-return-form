import { shopifyAdminGetNoCache } from "@/lib/shopifyAdminApi";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { ensureProductCatalogSyncedForWarehouseDay } from "@/lib/shopifyProductCatalog";
import type { OrderForPick } from "@/lib/fetchTodaysPickLists";
import { allKokobayLayoutBinCodes } from "@/lib/generateBins";
import { randomKokobayLocationForIndex } from "@/lib/kokobayLocationFormat";
import {
  fetchShopifyProductsForLineItemImages,
  lineItemImageUrlsFromProductMap,
} from "@/lib/shopifyLineItemImage";
import {
  colourValueFromLineDisplayName,
  isLikelySizeOnlyToken,
} from "@/lib/shopifyProductCatalog";
import { splitSizeFromColourParens } from "@/lib/splitSizeFromColourParens";
import { displaySkuForShopifyLineItem } from "@/lib/shopifyLineItemSku";
import { lineItemTitle } from "@/lib/shopifyLineItemTitle";
import { sizeFromShopifyLineItem } from "@/lib/variantTitleSizeLabel";
import type { ShopifyLineItem, ShopifyOrder, ShopifyOrdersResponse } from "@/types/shopify";
import type { WarehouseOrderLine } from "@/lib/warehouseMockOrders";
import type { WarehouseProduct } from "@/lib/warehouseMockProducts";
import { loadBinCodeByVariantId } from "@/lib/loadBinCodeByVariantId";
import { DEFAULT_PRODUCT_PLACE_LOCATION } from "@/lib/shopifyProductCatalog";
import {
  WAREHOUSE_TZ,
  getTodayCalendarDateKeyInLondon,
  getWarehouseDayCreatedAtQueryBoundsUtc,
  isOrderOnWarehouseDay,
} from "@/lib/warehouseLondonDay";
import { UK_PREMIUM_NDD_LINE_TITLE } from "@/lib/shopifyShippingLineTitles";
import { DateTime } from "luxon";

/**
 * First/last for labels; order: customer, then shipping, then billing.
 */
export function displayCustomerNameParts(
  o: ShopifyOrder,
): { firstName: string; lastName: string } {
  const c = o.customer;
  if (c) {
    const f = String(c.first_name ?? "").trim();
    const l = String(c.last_name ?? "").trim();
    if (f || l) {
      return { firstName: f, lastName: l };
    }
  }
  const ship = o.shipping_address;
  if (ship) {
    const f = String(ship.first_name ?? "").trim();
    const l = String(ship.last_name ?? "").trim();
    if (f || l) {
      return { firstName: f, lastName: l };
    }
  }
  const bill = o.billing_address;
  if (bill) {
    const f = String(bill.first_name ?? "").trim();
    const l = String(bill.last_name ?? "").trim();
    if (f || l) {
      return { firstName: f, lastName: l };
    }
  }
  return { firstName: "", lastName: "" };
}

const PICK_PAGE_LIM = 250;
const PICK_MAX_PAGES = 32;

/** Enrich pick lines: Mongo `products` (name, colour, thumb, **location**), then stock bins. */
type MongoBySku = Map<
  string,
  Pick<
    WarehouseProduct,
    | "sku"
    | "name"
    | "unitPricePence"
    | "color"
    | "thumbnailImageUrl"
    | "location"
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
            location: 1,
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

/** Resolve variant/product images for line items; keys are `String(line_item.id)`. */
async function lineItemImageUrlByLineId(
  orders: ShopifyOrder[],
): Promise<Map<string, string>> {
  const lineItems: Pick<ShopifyLineItem, "id" | "product_id" | "variant_id">[] =
    [];
  const productIds = new Set<number>();
  for (const o of orders) {
    for (const li of o.line_items ?? []) {
      if ((li.quantity ?? 0) <= 0) continue;
      lineItems.push({
        id: li.id,
        product_id: li.product_id,
        variant_id: li.variant_id,
      });
      if (typeof li.product_id === "number" && li.product_id > 0) {
        productIds.add(li.product_id);
      }
    }
  }
  if (lineItems.length === 0) return new Map();
  const byProduct = await fetchShopifyProductsForLineItemImages([
    ...productIds,
  ]);
  return lineItemImageUrlsFromProductMap(lineItems, byProduct);
}

/** Deterministic 0…2³²-1 from a string; used so the same SKU always gets the same fallback bin. */
function indexFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/**
 * When neither `stock.binCode` nor `products.location` is set. Picks a cell from
 * the same full layout as `POST /api/bins` using `variantId`+SKU to avoid
 * the frequent collisions of {@link randomKokobayLocationForIndex} with SKU-only
 * (different variants could read the same code, e.g. `B-01-C`).
 * Shape: `RACK-BAY-LEVEL` like `stock.binCode`.
 */
function mockLocationForUnstockedLine(sku: string, variantId: number): string {
  const s =
    Number.isFinite(variantId) && variantId > 0
      ? `v:${variantId}\t${String(sku).trim()}`
      : `sku:${String(sku).trim()}`;
  const h = (indexFromString(s) * 0x9e3779b9) >>> 0;
  const codes = allKokobayLayoutBinCodes();
  if (codes.length > 0) {
    return codes[h % codes.length]!;
  }
  return randomKokobayLocationForIndex(h);
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
  lineImageByLineId: Map<string, string>,
): WarehouseOrderLine[] {
  const withQty = o.line_items.filter((li) => (li.quantity ?? 0) > 0);
  return withQty.map((li) => {
    const sku = displaySkuForShopifyLineItem(li);
    const vid = Number(li.variant_id);
    const fromStock =
      Number.isFinite(vid) && binByVariantId.get(vid)?.trim();
    const row = m.get(sku);
    const rawLoc = row?.location?.trim() ?? "";
    // Synced `products` default every new row to the same code — that is not a
    // real unique bin. Ignore it so we fall back to per-SKU placement (or
    // `stock` when the variant is assigned a bin by POST /api/stock/seed).
    const fromProductLoc =
      rawLoc.length > 0 && rawLoc !== DEFAULT_PRODUCT_PLACE_LOCATION
        ? rawLoc
        : null;
    const location =
      typeof fromStock === "string" && fromStock
        ? fromStock
        : fromProductLoc
          ? fromProductLoc
          : mockLocationForUnstockedLine(sku, Number.isFinite(vid) && vid > 0 ? vid : 0);
    const fromShopify = lineImageByLineId.get(String(li.id))?.trim();
    const lineDisplayName =
      row?.name?.trim() ||
      (typeof (li as { name?: string }).name === "string"
        ? (li as { name: string }).name.trim()
        : "") ||
      lineItemTitle(li);
    const fromMongo = row?.color?.trim();
    const fromTitle = colourValueFromLineDisplayName(lineDisplayName);
    const mongoSane =
      fromMongo &&
      fromMongo !== "—" &&
      !isLikelySizeOnlyToken(fromMongo);
    let lineColor: string | undefined = (mongoSane ? fromMongo : fromTitle) || undefined;
    let size: string | undefined = sizeFromShopifyLineItem(li, lineColor);
    if (lineColor) {
      const { colour, sizeFromParens } = splitSizeFromColourParens(lineColor);
      lineColor = colour || undefined;
      if (sizeFromParens && !size) {
        size = sizeFromParens;
      }
    }
    const pence = Math.max(
      0,
      Math.round(Number.parseFloat(String(li.price) || "0") * 100) || 0,
    );
    return {
      sku,
      quantity: Math.max(1, Math.trunc(Number(li.quantity) || 0)),
      name: lineDisplayName,
      color: lineColor,
      ...(size ? { size } : {}),
      thumbnailImageUrl:
        (fromShopify && fromShopify.length > 0
          ? fromShopify
          : row?.thumbnailImageUrl?.trim()) || undefined,
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
  const [m, binByVariantId, lineImageByLineId] = await Promise.all([
    loadMongoBySkus(allSkus),
    loadBinCodeByVariantId(allVariantIds),
    lineItemImageUrlByLineId(filtered),
  ]);

  return filtered.map((o) => {
    const { firstName, lastName } = displayCustomerNameParts(o);
    return {
      orderNumber: o.name,
      status: shopifyOrderStatusLabel(o),
      items: toWarehouseLines(o, m, binByVariantId, lineImageByLineId),
      ...(firstName || lastName
        ? { customerFirstName: firstName, customerLastName: lastName }
        : {}),
    } satisfies OrderForPick;
  });
}

/**
 * Requests orders whose `created_at` falls within the full warehouse `dayKey`
 * (London) via Shopify query params, paginating past 250 so “today’s” set is
 * not truncated to the store’s 250 most-recent. Lines and prices from Shopify;
 * `stock.binCode` when the variant is present in Mongo `stock` (from
 * `POST /api/stock/seed`); else Mongo `products.location` for that SKU; else
 * a deterministic per-SKU placeholder (same bin for the same SKU on every
 * order). `products` also supplies display fields by SKU.
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
  const [m, binByVariantId, lineImageByLineId] = await Promise.all([
    loadMongoBySkus(allSkus),
    loadBinCodeByVariantId(allVariantIds),
    lineItemImageUrlByLineId(inDay),
  ]);

  return inDay.map((o) => {
    const { firstName, lastName } = displayCustomerNameParts(o);
    return {
      orderNumber: o.name,
      status: shopifyOrderStatusLabel(o),
      items: toWarehouseLines(o, m, binByVariantId, lineImageByLineId),
      ...(firstName || lastName
        ? { customerFirstName: firstName, customerLastName: lastName }
        : {}),
    } satisfies OrderForPick;
  });
}
