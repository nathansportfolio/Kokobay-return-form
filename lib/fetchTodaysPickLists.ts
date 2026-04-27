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
import { parseDashedProductTitle } from "@/lib/assemblyLineTitle";
import { compareKokobayLocation } from "@/lib/kokobayLocationFormat";
import {
  getTodaysShopifyOrderForPicks,
  getUkPremiumShopifyOrdersForPicks,
  isShopifyWarehouseDataEnabled,
} from "@/lib/shopifyWarehouseDayOrders";
import { hexForProductColorName } from "@/lib/warehouseProductColors";
import { withPickableLinesOnly } from "@/lib/warehousePickableLine";
import {
  clampOrdersPerList,
  type AssemblyLine,
  type OrderAssembly,
  type OrderForPick,
  type PickStep,
  type TodaysPickListBatch,
} from "@/lib/picklistShared";

export {
  DEFAULT_ORDERS_PER_PICK_LIST,
  parseOrdersPerListParam,
  clampOrdersPerList,
  pickStepForOrdersLabel,
  type OrderForPick,
  type PickStep,
  type AssemblyLine,
  type OrderAssembly,
  type TodaysPickListBatch,
} from "./picklistShared";

/**
 * Batching always partitions the queue: each `OrderForPick` is a whole
 * order (all line items) on exactly one sheet. Call after chunking; throws if
 * a sheet omits/duplicates an order.
 */
function assertBatchesPartitionQueue(
  queue: OrderForPick[],
  groups: OrderForPick[][],
  label: string,
) {
  const flat = groups.flat();
  if (flat.length !== queue.length) {
    throw new Error(
      `[${label}] Pick batching: got ${flat.length} order slots in batches, queue has ${queue.length}`,
    );
  }
  const byNumber = new Map<string, number>();
  for (const o of flat) {
    byNumber.set(o.orderNumber, (byNumber.get(o.orderNumber) ?? 0) + 1);
  }
  for (const o of queue) {
    if (byNumber.get(o.orderNumber) !== 1) {
      throw new Error(
        `[${label}] Order ${o.orderNumber} is not on exactly one pick sheet (count=${byNumber.get(
          o.orderNumber,
        ) ?? 0}). A single order must not be split or duplicated across lists.`,
      );
    }
  }
}

/** Fails if upstream (Shop/DB) passed the same `orderNumber` twice — would otherwise look like the same order on two sheets. */
function assertOrderQueueUnique(orders: OrderForPick[], label: string) {
  const firstIdx = new Map<string, number>();
  for (let i = 0; i < orders.length; i += 1) {
    const n = orders[i]!.orderNumber;
    if (n === undefined || n === null) {
      throw new Error(`[${label}] orderNumber missing at input index ${i}`);
    }
    if (firstIdx.has(n)) {
      throw new Error(
        `[${label}] Duplicate orderNumber "${n}" in pick queue (indices ${firstIdx.get(
          n,
        )} and ${i}). Deduplicate source data; each order must appear once.`,
      );
    }
    firstIdx.set(n, i);
  }
}

const DEFAULT_LINE_LOCATION = "U-20-F3";

/** Resolves a line to the same `location` string the pick walk / merge use. */
function lineLocationForPick(line: { location?: string }): string {
  return String(line.location ?? "").trim() || DEFAULT_LINE_LOCATION;
}

/**
 * One key per resolvable **pick stop** for an order, aligned with
 * `buildSortedSteps` (`location` + `SKU` → merged qty on one walk line).
 * Preferring max overlap of these keys keeps orders that need the same bin+SKU
 * together so you do not revisit that stop on a second pick.
 */
function pickStopKeysForOrder(o: OrderForPick): Set<string> {
  const s = new Set<string>();
  for (const line of o.items) {
    if ((line.quantity ?? 0) <= 0) {
      continue;
    }
    const sku = String(line.sku ?? "").trim();
    if (!sku) {
      continue;
    }
    const location = lineLocationForPick(line);
    s.add(`${location}\t${sku}`);
  }
  return s;
}

function countSetOverlap(candidate: Set<string>, existing: Set<string>): number {
  let n = 0;
  for (const x of candidate) {
    if (existing.has(x)) {
      n += 1;
    }
  }
  return n;
}

/**
 * Batches of at most `size` orders, seed = next in queue (order #). Each
 * **slot** is filled with the remaining order that shares the most
 * **(location+SKU) pick stops** with the batch (same bin+line = merged qty
 * in one walk). Ties: lower `orderNumber`. If nothing shares a stop, take the
 * next order in queue like plain chunking. **Does not** pre-split A–I vs J–U:
 * a list may straddle the warehouse so the same (bin+SKU) is not a separate
 * pick. If a SKU appears in more than `size` orders, the bin may still be visited
 * on more than one list (unavoidable for capacity).
 */
function chunkOrdersGreedyStopOverlap(
  orders: OrderForPick[],
  size: number,
): OrderForPick[][] {
  if (size < 1 || orders.length === 0) {
    return orders.length === 0 ? [] : [orders];
  }
  const remaining = [...orders];
  const out: OrderForPick[][] = [];
  while (remaining.length > 0) {
    const first = remaining.shift()!;
    const batch: OrderForPick[] = [first];
    const batchStops = new Set(pickStopKeysForOrder(first));
    while (batch.length < size && remaining.length > 0) {
      let bestI = -1;
      let bestOverlap = -1;
      for (let i = 0; i < remaining.length; i += 1) {
        const o = remaining[i]!;
        const ov = countSetOverlap(
          pickStopKeysForOrder(o),
          batchStops,
        );
        if (ov > bestOverlap) {
          bestOverlap = ov;
          bestI = i;
        } else if (ov === bestOverlap && bestI >= 0) {
          if (o.orderNumber.localeCompare(remaining[bestI]!.orderNumber) < 0) {
            bestI = i;
          }
        }
      }
      if (bestOverlap > 0 && bestI >= 0) {
        const [next] = remaining.splice(bestI, 1);
        batch.push(next);
        for (const k of pickStopKeysForOrder(next)) {
          batchStops.add(k);
        }
      } else {
        const next = remaining.shift()!;
        batch.push(next);
        for (const k of pickStopKeysForOrder(next)) {
          batchStops.add(k);
        }
      }
    }
    out.push(batch);
  }
  return out;
}

/**
 * One stop per SKU+location, quantities merged across the batch; walk order is
 * rack → bay → level (legacy `B-04-C3` also uses slot) → SKU.
 */
function addLineColor(set: Set<string>, line: WarehouseOrderLine) {
  const c = line.color?.trim();
  if (c) set.add(c);
}

function addLineSize(set: Set<string>, line: WarehouseOrderLine) {
  const s = line.size?.trim();
  if (s) set.add(s);
}

function lineThumbnailImageUrl(
  line: WarehouseOrderLine,
): string | undefined {
  const u = line.thumbnailImageUrl?.trim();
  return u || undefined;
}

/**
 * One short product line for the pick walk: drops `- colour` / `- size` so the
 * name matches across lines; keeps mock category `(…)` stripped.
 */
function pickListLineName(line: WarehouseOrderLine): string {
  const sku = String(line.sku);
  const base = String(line.name ?? "").trim() || sku;
  const p = parseDashedProductTitle(base);
  if (p.colour != null && p.colour !== "") {
    const t = p.product.trim();
    if (t) {
      return t;
    }
  }
  const without = base.replace(/\s+\([^)]+\)\s*$/u, "").trim();
  return without || base;
}

function buildSortedSteps(orders: OrderForPick[]): PickStep[] {
  type Agg = {
    sku: string;
    name: string;
    location: string;
    qty: number;
    /** Merged line-item rows contributing to this stop. */
    sourceLineItemCount: number;
    orders: Set<string>;
    /** orderNumber → how many line rows in this order hit this (location+SKU) stop. */
    lineRowsByOrder: Map<string, number>;
    colors: Set<string>;
    sizes: Set<string>;
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
        prev.sourceLineItemCount += 1;
        prev.orders.add(ord.orderNumber);
        {
          const on = ord.orderNumber;
          prev.lineRowsByOrder.set(
            on,
            (prev.lineRowsByOrder.get(on) ?? 0) + 1,
          );
        }
        addLineColor(prev.colors, line);
        addLineSize(prev.sizes, line);
        if (!prev.thumbnailImageUrl) {
          const t = lineThumbnailImageUrl(line);
          if (t) prev.thumbnailImageUrl = t;
        }
      } else {
        const colors = new Set<string>();
        const sizes = new Set<string>();
        addLineColor(colors, line);
        addLineSize(sizes, line);
        const thumb = lineThumbnailImageUrl(line);
        const rowsMap = new Map<string, number>();
        rowsMap.set(ord.orderNumber, 1);
        map.set(key, {
          sku,
          name,
          location,
          qty: line.quantity,
          sourceLineItemCount: 1,
          orders: new Set([ord.orderNumber]),
          lineRowsByOrder: rowsMap,
          colors,
          sizes,
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
    const forOrderLineRowCounts = [...r.lineRowsByOrder.entries()]
      .map(([orderNumber, lineRows]) => ({ orderNumber, lineRows }))
      .sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));
    const color =
      r.colors.size > 0
        ? [...r.colors].sort((x, y) => x.localeCompare(y)).join(" · ")
        : undefined;
    const single =
      r.colors.size === 1 ? [...r.colors][0]!.trim() : "";
    const colorHex =
      single && single !== "—" ? hexForProductColorName(single) : undefined;
    const size =
      r.sizes.size > 0
        ? [...r.sizes].sort((x, y) => x.localeCompare(y)).join(" · ")
        : undefined;
    return {
      step: i + 1,
      sku: r.sku,
      name: r.name,
      location: r.location,
      quantity: r.qty,
      sourceLineItemCount: r.sourceLineItemCount,
      forOrders: [...r.orders].sort((x, y) => x.localeCompare(y)),
      forOrderLineRowCounts,
      ...(color ? { color } : {}),
      ...(colorHex ? { colorHex } : {}),
      ...(size ? { size } : {}),
      ...(r.thumbnailImageUrl
        ? { thumbnailImageUrl: r.thumbnailImageUrl }
        : {}),
    };
  });
}

function buildAssemblyByOrder(orders: OrderForPick[]): OrderAssembly[] {
  return orders.map((o) => ({
    orderNumber: o.orderNumber,
    ...(o.customerFirstName != null && String(o.customerFirstName).trim() !== ""
      ? { customerFirstName: String(o.customerFirstName).trim() }
      : {}),
    ...(o.customerLastName != null && String(o.customerLastName).trim() !== ""
      ? { customerLastName: String(o.customerLastName).trim() }
      : {}),
    lines: o.items.map((line, i) => ({
      lineIndex: i + 1,
      sku: String(line.sku),
      quantity: line.quantity,
      name: pickListLineName(line),
      ...(line.color?.trim() && line.color.trim() !== "—"
        ? {
            color: line.color.trim(),
            colorHex: hexForProductColorName(line.color.trim()),
          }
        : {}),
      ...(line.size?.trim() ? { size: line.size.trim() } : {}),
      ...(line.thumbnailImageUrl?.trim()
        ? { thumbnailImageUrl: line.thumbnailImageUrl.trim() }
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
    allTodays.length === 0
      ? 0
      : chunkOrdersGreedyStopOverlap(allTodays, size).length;
  const dayOrderCount = allTodays.length;

  const [completedSet, completedPicklistCount] = await Promise.all([
    getCompletedOrderNumbersSetForPicklistContext(
      dayKey,
      PICKLIST_LIST_KIND_STANDARD,
    ),
    countCompletedPicklistsForDay(dayKey, PICKLIST_LIST_KIND_STANDARD),
  ]);

  const todays = allTodays.filter((o) => !completedSet.has(o.orderNumber));
  assertOrderQueueUnique(todays, "fetchTodaysPickLists");

  const groups = chunkOrdersGreedyStopOverlap(todays, size);
  assertBatchesPartitionQueue(todays, groups, "fetchTodaysPickLists");

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
    allTodays.length === 0
      ? 0
      : chunkOrdersGreedyStopOverlap(allTodays, size).length;
  const dayOrderCount = allTodays.length;

  const [completedSet, completedPicklistCount] = await Promise.all([
    getCompletedOrderNumbersSetForPicklistContext(
      dayKey,
      PICKLIST_LIST_KIND_UK_PREMIUM,
    ),
    countCompletedPicklistsForDay(dayKey, PICKLIST_LIST_KIND_UK_PREMIUM),
  ]);

  const todays = allTodays.filter((o) => !completedSet.has(o.orderNumber));
  assertOrderQueueUnique(todays, "fetchUkPremiumPickLists");
  const groups = chunkOrdersGreedyStopOverlap(todays, size);
  assertBatchesPartitionQueue(todays, groups, "fetchUkPremiumPickLists");

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
