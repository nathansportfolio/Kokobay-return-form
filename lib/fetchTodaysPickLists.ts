import {
  countCompletedPicklistsForDay,
  getCompletedOrderNumbersSetForPicklistContext,
} from "@/lib/completedPicklist";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import type { WarehouseOrderLine } from "@/lib/warehouseMockOrders";
import {
  WAREHOUSE_TZ,
  getPickListOrderDayKey,
  getTodayCalendarDateKeyInLondon,
  isOrderOnWarehouseDay,
} from "@/lib/warehouseLondonDay";
import {
  PICKLIST_LIST_KIND_STANDARD,
  PICKLIST_LIST_KIND_UK_PREMIUM,
} from "@/lib/picklistListKind";
import {
  compareKokobayLocation,
  parseKokobayLocation,
} from "@/lib/kokobayLocationFormat";
import {
  isFirstPhysicalRunAisleIndex,
  rackCodeToIndex,
} from "@/lib/warehouseRackLayout";
import {
  getTodaysShopifyOrderForPicks,
  getUkPremiumShopifyOrdersForPicks,
  isShopifyWarehouseDataEnabled,
} from "@/lib/shopifyWarehouseDayOrders";
import { withPickableLinesOnly } from "@/lib/warehousePickableLine";

export const DEFAULT_ORDERS_PER_PICK_LIST = 5;
const MIN_ORDERS_PER_PICK = 1;
const MAX_ORDERS_PER_PICK = 10;

export function parseOrdersPerListParam(
  raw: string | string[] | undefined,
): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(String(s ?? ""), 10);
  if (Number.isNaN(n)) return DEFAULT_ORDERS_PER_PICK_LIST;
  return Math.min(MAX_ORDERS_PER_PICK, Math.max(MIN_ORDERS_PER_PICK, n));
}

export function clampOrdersPerList(n: number): number {
  if (Number.isNaN(n) || n < MIN_ORDERS_PER_PICK) return DEFAULT_ORDERS_PER_PICK_LIST;
  return Math.min(MAX_ORDERS_PER_PICK, Math.max(MIN_ORDERS_PER_PICK, Math.floor(n)));
}

export type OrderForPick = {
  orderNumber: string;
  status: string;
  items: WarehouseOrderLine[];
};

export type PickStep = {
  step: number;
  sku: string;
  name: string;
  location: string;
  quantity: number;
  forOrders: string[];
  /** Product colour for this stop (merged with " · " if several lines differ). */
  color?: string;
  /** Product thumbnail URL from the order line (e.g. Unsplash mock). */
  thumbnailImageUrl?: string;
};

export type AssemblyLine = {
  /** 1-based line order within the order (for packing). */
  lineIndex: number;
  sku: string;
  quantity: number;
  name: string;
  color?: string;
};

export type OrderAssembly = {
  orderNumber: string;
  lines: AssemblyLine[];
};

export type TodaysPickListBatch = {
  /**
   * 1-based index of this list among *active* lists only. Used in URLs (`?list=`).
   */
  batchIndex: number;
  /**
   * 1-based pick for the whole warehouse day, counting completed work first.
   * (e.g. 4 already archived → the next active list is 5.)
   */
  displayPickListNumber: number;
  orderNumbers: string[];
  steps: PickStep[];
  /** Original line order per order — use when assembling after the pick walk. */
  assembly: OrderAssembly[];
};

function chunkOrders<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

const DEFAULT_LINE_LOCATION = "U-20-F3";

type WarehouseRun = "A_I" | "J_U" | "split";

/**
 * A – I and J – U are separate physical runs. Prefer a pick list of N orders
 * that all sit in the same run when the order’s stock does not straddle the
 * boundary. Orders that use both runs are batched after single-run orders.
 */
function lineLocationForPick(line: { location?: string }): string {
  return String(line.location ?? "").trim() || DEFAULT_LINE_LOCATION;
}

function orderWarehouseRun(ord: OrderForPick): WarehouseRun {
  if (!ord.items.length) {
    return "J_U";
  }
  let hasA_I = false;
  let hasJ_U = false;
  for (const line of ord.items) {
    const p = parseKokobayLocation(lineLocationForPick(line));
    const aisle = p?.aisle ?? "U";
    const n = rackCodeToIndex(aisle) || 21;
    if (isFirstPhysicalRunAisleIndex(n)) {
      hasA_I = true;
    } else {
      hasJ_U = true;
    }
  }
  if (hasA_I && hasJ_U) return "split";
  if (hasJ_U) return "J_U";
  return "A_I";
}

/**
 * Splits the day’s queue (already sorted) into A–I chunks, then J–U, then
 * straddled orders, each chunk no larger than `size`.
 */
function chunkOrdersByWarehouseRun(
  orders: OrderForPick[],
  size: number,
): OrderForPick[][] {
  const a_i: OrderForPick[] = [];
  const j_u: OrderForPick[] = [];
  const sp: OrderForPick[] = [];
  for (const o of orders) {
    const r = orderWarehouseRun(o);
    if (r === "A_I") a_i.push(o);
    else if (r === "J_U") j_u.push(o);
    else sp.push(o);
  }
  return [
    ...chunkOrders(a_i, size),
    ...chunkOrders(j_u, size),
    ...chunkOrders(sp, size),
  ];
}

/**
 * One stop per SKU+location, quantities merged across the batch; walk order is
 * rack → bay → level (legacy `B-04-C3` also uses slot) → SKU.
 */
function addLineColor(set: Set<string>, line: WarehouseOrderLine) {
  const c = line.color?.trim();
  if (c) set.add(c);
}

function lineThumbnailImageUrl(
  line: WarehouseOrderLine,
): string | undefined {
  const u = line.thumbnailImageUrl?.trim();
  return u || undefined;
}

/** Strips a trailing ` (…)` from product titles (e.g. mock category “Women's Footwear”) for pick UIs. */
function pickListLineName(line: WarehouseOrderLine): string {
  const sku = String(line.sku);
  const base = String(line.name ?? "").trim() || sku;
  const without = base.replace(/\s+\([^)]+\)\s*$/u, "").trim();
  return without || base;
}

function buildSortedSteps(orders: OrderForPick[]): PickStep[] {
  type Agg = {
    sku: string;
    name: string;
    location: string;
    qty: number;
    orders: Set<string>;
    colors: Set<string>;
    thumbnailImageUrl?: string;
  };
  const map = new Map<string, Agg>();

  for (const ord of orders) {
    for (const line of ord.items) {
      const location = lineLocationForPick(line);
      const sku = String(line.sku);
      const key = `${location}\t${sku}`;
      const prev = map.get(key);
      const name = pickListLineName(line);
      if (prev) {
        prev.qty += line.quantity;
        prev.orders.add(ord.orderNumber);
        addLineColor(prev.colors, line);
        if (!prev.thumbnailImageUrl) {
          const t = lineThumbnailImageUrl(line);
          if (t) prev.thumbnailImageUrl = t;
        }
      } else {
        const colors = new Set<string>();
        addLineColor(colors, line);
        const thumb = lineThumbnailImageUrl(line);
        map.set(key, {
          sku,
          name,
          location,
          qty: line.quantity,
          orders: new Set([ord.orderNumber]),
          colors,
          ...(thumb ? { thumbnailImageUrl: thumb } : {}),
        });
      }
    }
  }

  const rows = [...map.values()].sort((a, b) => {
    const c = compareKokobayLocation(a.location, b.location);
    if (c !== 0) return c;
    return a.sku.localeCompare(b.sku);
  });

  return rows.map((r, i) => {
    const color =
      r.colors.size > 0
        ? [...r.colors].sort((x, y) => x.localeCompare(y)).join(" · ")
        : undefined;
    return {
      step: i + 1,
      sku: r.sku,
      name: r.name,
      location: r.location,
      quantity: r.qty,
      forOrders: [...r.orders].sort((x, y) => x.localeCompare(y)),
      ...(color ? { color } : {}),
      ...(r.thumbnailImageUrl
        ? { thumbnailImageUrl: r.thumbnailImageUrl }
        : {}),
    };
  });
}

function buildAssemblyByOrder(orders: OrderForPick[]): OrderAssembly[] {
  return orders.map((o) => ({
    orderNumber: o.orderNumber,
    lines: o.items.map((line, i) => ({
      lineIndex: i + 1,
      sku: String(line.sku),
      quantity: line.quantity,
      name: pickListLineName(line),
      ...(line.color?.trim()
        ? { color: line.color.trim() }
        : {}),
    })),
  }));
}

export async function fetchTodaysPickLists(ordersPerList: number): Promise<{
  dayKey: string;
  ordersPerList: number;
  /** Pick lists for the day with this batch size, if no completions (full day order count / batching). */
  totalPicklistsForDay: number;
  /** How many walk sessions were finished and recorded for this warehouse day. */
  completedPicklistCount: number;
  /** Orders placed on the warehouse day (before excluding completed). */
  dayOrderCount: number;
  batches: TodaysPickListBatch[];
  dataSource: "shopify" | "sample";
}> {
  const dayKey = getPickListOrderDayKey();

  let allTodays: OrderForPick[] = [];
  if (isShopifyWarehouseDataEnabled()) {
    allTodays = await getTodaysShopifyOrderForPicks(dayKey);
  } else {
    const client = await clientPromise;
    const db = client.db(kokobayDbName);
    const raw = await db
      .collection("orders")
      .find(
        {},
        {
          projection: {
            orderNumber: 1,
            status: 1,
            items: 1,
            createdAt: 1,
            _id: 0,
          },
        },
      )
      .sort({ orderNumber: 1 })
      .limit(500)
      .toArray();

    for (const doc of raw) {
      const createdAt = doc.createdAt instanceof Date ? doc.createdAt : null;
      if (
        !createdAt ||
        !isOrderOnWarehouseDay(createdAt, dayKey, WAREHOUSE_TZ)
      ) {
        continue;
      }
      allTodays.push({
        orderNumber: String(doc.orderNumber ?? ""),
        status: String(doc.status ?? "pending"),
        items: (doc.items ?? []) as WarehouseOrderLine[],
      });
    }
  }

  allTodays = withPickableLinesOnly(allTodays);

  allTodays.sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));

  const size = clampOrdersPerList(ordersPerList);
  const totalPicklistsForDay =
    allTodays.length === 0 ? 0 : chunkOrders(allTodays, size).length;
  const dayOrderCount = allTodays.length;

  const [completedSet, completedPicklistCount] = await Promise.all([
    getCompletedOrderNumbersSetForPicklistContext(
      dayKey,
      PICKLIST_LIST_KIND_STANDARD,
    ),
    countCompletedPicklistsForDay(dayKey, PICKLIST_LIST_KIND_STANDARD),
  ]);

  const todays = allTodays.filter((o) => !completedSet.has(o.orderNumber));

  const groups = chunkOrdersByWarehouseRun(todays, size);
  const batches: TodaysPickListBatch[] = groups.map((group, idx) => {
    const batchIndex = idx + 1;
    return {
      batchIndex,
      displayPickListNumber: completedPicklistCount + batchIndex,
      orderNumbers: group.map((o) => o.orderNumber),
      steps: buildSortedSteps(group),
      assembly: buildAssemblyByOrder(group),
    };
  });

  return {
    dayKey,
    ordersPerList: size,
    totalPicklistsForDay,
    completedPicklistCount,
    dayOrderCount,
    batches,
    dataSource: isShopifyWarehouseDataEnabled() ? "shopify" : "sample",
  };
}

/**
 * **UK Premium / NDD (Shopify only):** orders on **today** (London) with
 * **UK Premium Delivery (1-2 working days)**, `created_at` on that day **before 14:00** London.
 */
export async function fetchUkPremiumPickLists(ordersPerList: number): Promise<{
  dayKey: string;
  ordersPerList: number;
  totalPicklistsForDay: number;
  completedPicklistCount: number;
  dayOrderCount: number;
  batches: TodaysPickListBatch[];
  dataSource: "shopify" | "empty";
}> {
  const dayKey = getTodayCalendarDateKeyInLondon();
  if (!isShopifyWarehouseDataEnabled()) {
    return {
      dayKey,
      ordersPerList: clampOrdersPerList(ordersPerList),
      totalPicklistsForDay: 0,
      completedPicklistCount: 0,
      dayOrderCount: 0,
      batches: [],
      dataSource: "empty",
    };
  }

  let allTodays: OrderForPick[] = await getUkPremiumShopifyOrdersForPicks();
  allTodays = withPickableLinesOnly(allTodays);
  allTodays.sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));

  const size = clampOrdersPerList(ordersPerList);
  const totalPicklistsForDay =
    allTodays.length === 0 ? 0 : chunkOrders(allTodays, size).length;
  const dayOrderCount = allTodays.length;

  const [completedSet, completedPicklistCount] = await Promise.all([
    getCompletedOrderNumbersSetForPicklistContext(
      dayKey,
      PICKLIST_LIST_KIND_UK_PREMIUM,
    ),
    countCompletedPicklistsForDay(dayKey, PICKLIST_LIST_KIND_UK_PREMIUM),
  ]);

  const todays = allTodays.filter((o) => !completedSet.has(o.orderNumber));
  const groups = chunkOrdersByWarehouseRun(todays, size);
  const batches: TodaysPickListBatch[] = groups.map((group, idx) => {
    const batchIndex = idx + 1;
    return {
      batchIndex,
      displayPickListNumber: completedPicklistCount + batchIndex,
      orderNumbers: group.map((o) => o.orderNumber),
      steps: buildSortedSteps(group),
      assembly: buildAssemblyByOrder(group),
    };
  });

  return {
    dayKey,
    ordersPerList: size,
    totalPicklistsForDay,
    completedPicklistCount,
    dayOrderCount,
    batches,
    dataSource: "shopify",
  };
}
