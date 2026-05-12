import {
  countCompletedPicklistsForDay,
  getCompletedOrderNumbersSetForPicklistContext,
} from "@/lib/completedPicklist";
import { getPausedOrderNumbersSetForPicklistContext } from "@/lib/orderPickPause";
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
  getTodaysShopifyOrderForPicks,
  getUkPremiumShopifyOrdersForPicks,
  isShopifyWarehouseDataEnabled,
} from "@/lib/shopifyWarehouseDayOrders";
import { withPickableLinesOnly } from "@/lib/warehousePickableLine";
import {
  buildAssemblyFromOrders,
  buildSortedStepsFromOrders,
  lineLocationForPick,
} from "@/lib/picklistStepsFromOrders";
import {
  clampItemsPerList,
  clampOrdersPerList,
  itemUnitsForOrder,
  type OrderForPick,
  type TodaysPickListBatch,
} from "@/lib/picklistShared";

export {
  DEFAULT_ITEMS_PER_PICK_LIST,
  DEFAULT_ORDERS_PER_PICK_LIST,
  parseItemsPerListParam,
  parseOrdersPerListParam,
  clampItemsPerList,
  clampOrdersPerList,
  itemUnitsForOrder,
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

/**
 * One key per resolvable **pick stop** for an order, aligned with
 * `buildSortedStepsFromOrders` (`location` + `SKU` → merged qty on one walk line).
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
 * Batches of at most `maxOrders` orders and combined line **qty** at most
 * `maxItemUnits`. An order with more than `maxItemUnits` is always alone
 * (one list for that order only). Otherwise same greedy (location+SKU) overlap
 * and queue order as before, but the next order must fit the item cap.
 */
function chunkOrdersGreedyStopOverlap(
  orders: OrderForPick[],
  maxOrders: number,
  maxItemUnits: number,
): OrderForPick[][] {
  if (maxOrders < 1 || maxItemUnits < 1 || orders.length === 0) {
    return orders.length === 0 ? [] : [orders];
  }
  const remaining = [...orders];
  const out: OrderForPick[][] = [];
  while (remaining.length > 0) {
    const first = remaining.shift()!;
    const u0 = itemUnitsForOrder(first);
    if (u0 > maxItemUnits) {
      out.push([first]);
      continue;
    }
    const batch: OrderForPick[] = [first];
    let batchUnits = u0;
    const batchStops = new Set(pickStopKeysForOrder(first));
    while (batch.length < maxOrders && remaining.length > 0) {
      const fitting: number[] = [];
      for (let i = 0; i < remaining.length; i += 1) {
        if (batchUnits + itemUnitsForOrder(remaining[i]!) <= maxItemUnits) {
          fitting.push(i);
        }
      }
      if (fitting.length === 0) {
        break;
      }
      let bestI = -1;
      let bestOverlap = -1;
      for (const i of fitting) {
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
        batchUnits += itemUnitsForOrder(next);
        for (const k of pickStopKeysForOrder(next)) {
          batchStops.add(k);
        }
      } else {
        const idx = Math.min(...fitting);
        const [next] = remaining.splice(idx, 1);
        batch.push(next);
        batchUnits += itemUnitsForOrder(next);
        for (const k of pickStopKeysForOrder(next)) {
          batchStops.add(k);
        }
      }
    }
    out.push(batch);
  }
  return out;
}

export async function fetchTodaysPickLists(
  ordersPerList: number,
  itemsPerList: number,
): Promise<{
  dayKey: string;
  ordersPerList: number;
  itemsPerList: number;
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

  const maxOrders = clampOrdersPerList(ordersPerList);
  const maxItemUnits = clampItemsPerList(itemsPerList);
  const totalPicklistsForDay =
    allTodays.length === 0
      ? 0
      : chunkOrdersGreedyStopOverlap(
          allTodays,
          maxOrders,
          maxItemUnits,
        ).length;
  const dayOrderCount = allTodays.length;

  const [completedSet, completedPicklistCount, pausedSet] = await Promise.all([
    getCompletedOrderNumbersSetForPicklistContext(
      dayKey,
      PICKLIST_LIST_KIND_STANDARD,
    ),
    countCompletedPicklistsForDay(dayKey, PICKLIST_LIST_KIND_STANDARD),
    getPausedOrderNumbersSetForPicklistContext(
      dayKey,
      PICKLIST_LIST_KIND_STANDARD,
    ),
  ]);

  const todays = allTodays.filter(
    (o) => !completedSet.has(o.orderNumber) && !pausedSet.has(o.orderNumber),
  );
  assertOrderQueueUnique(todays, "fetchTodaysPickLists");

  const groups = chunkOrdersGreedyStopOverlap(
    todays,
    maxOrders,
    maxItemUnits,
  );
  assertBatchesPartitionQueue(todays, groups, "fetchTodaysPickLists");

  const batches: TodaysPickListBatch[] = groups.map((group, idx) => {
    const batchIndex = idx + 1;
    return {
      batchIndex,
      displayPickListNumber: completedPicklistCount + batchIndex,
      orderNumbers: group.map((o) => o.orderNumber),
      orders: group,
      steps: buildSortedStepsFromOrders(group),
      assembly: buildAssemblyFromOrders(group),
    };
  });

  return {
    dayKey,
    ordersPerList: maxOrders,
    itemsPerList: maxItemUnits,
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
export async function fetchUkPremiumPickLists(
  ordersPerList: number,
  itemsPerList: number,
): Promise<{
  dayKey: string;
  ordersPerList: number;
  itemsPerList: number;
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
      itemsPerList: clampItemsPerList(itemsPerList),
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

  const maxOrders = clampOrdersPerList(ordersPerList);
  const maxItemUnits = clampItemsPerList(itemsPerList);
  const totalPicklistsForDay =
    allTodays.length === 0
      ? 0
      : chunkOrdersGreedyStopOverlap(
          allTodays,
          maxOrders,
          maxItemUnits,
        ).length;
  const dayOrderCount = allTodays.length;

  const [completedSet, completedPicklistCount, pausedSet] = await Promise.all([
    getCompletedOrderNumbersSetForPicklistContext(
      dayKey,
      PICKLIST_LIST_KIND_UK_PREMIUM,
    ),
    countCompletedPicklistsForDay(dayKey, PICKLIST_LIST_KIND_UK_PREMIUM),
    getPausedOrderNumbersSetForPicklistContext(
      dayKey,
      PICKLIST_LIST_KIND_UK_PREMIUM,
    ),
  ]);

  const todays = allTodays.filter(
    (o) => !completedSet.has(o.orderNumber) && !pausedSet.has(o.orderNumber),
  );
  assertOrderQueueUnique(todays, "fetchUkPremiumPickLists");
  const groups = chunkOrdersGreedyStopOverlap(
    todays,
    maxOrders,
    maxItemUnits,
  );
  assertBatchesPartitionQueue(todays, groups, "fetchUkPremiumPickLists");

  const batches: TodaysPickListBatch[] = groups.map((group, idx) => {
    const batchIndex = idx + 1;
    return {
      batchIndex,
      displayPickListNumber: completedPicklistCount + batchIndex,
      orderNumbers: group.map((o) => o.orderNumber),
      orders: group,
      steps: buildSortedStepsFromOrders(group),
      assembly: buildAssemblyFromOrders(group),
    };
  });

  return {
    dayKey,
    ordersPerList: maxOrders,
    itemsPerList: maxItemUnits,
    totalPicklistsForDay,
    completedPicklistCount,
    dayOrderCount,
    batches,
    dataSource: "shopify",
  };
}
