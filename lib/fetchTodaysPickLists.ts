import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import type { WarehouseOrderLine } from "@/lib/warehouseMockOrders";
import {
  WAREHOUSE_TZ,
  calendarDateKeyInTz,
  isOrderOnWarehouseDay,
} from "@/lib/warehouseLondonDay";
import { parseBinSortTuple, parseRowNumber } from "@/lib/warehouseLocationCodes";

export type OrderForPick = {
  orderNumber: string;
  status: string;
  items: WarehouseOrderLine[];
};

export type PickStep = {
  step: number;
  sku: string;
  name: string;
  row: string;
  bin: string;
  quantity: number;
  forOrders: string[];
};

export type TodaysPickListBatch = {
  batchIndex: number;
  orderNumbers: string[];
  steps: PickStep[];
};

function chunkOrders<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * One stop per SKU+location, quantities merged across the batch; walk order is
 * row → bin → sku for efficient warehouse paths.
 */
function buildSortedSteps(orders: OrderForPick[]): PickStep[] {
  type Agg = {
    sku: string;
    name: string;
    row: string;
    bin: string;
    qty: number;
    orders: Set<string>;
  };
  const map = new Map<string, Agg>();

  for (const ord of orders) {
    for (const line of ord.items) {
      const row = String(line.row ?? "").trim() || "Row ?";
      const bin = String(line.bin ?? "").trim() || "Bin ?";
      const sku = String(line.sku);
      const key = `${row}\t${bin}\t${sku}`;
      const prev = map.get(key);
      const name = String(line.name ?? sku);
      if (prev) {
        prev.qty += line.quantity;
        prev.orders.add(ord.orderNumber);
      } else {
        map.set(key, {
          sku,
          name,
          row,
          bin,
          qty: line.quantity,
          orders: new Set([ord.orderNumber]),
        });
      }
    }
  }

  const rows = [...map.values()].sort((a, b) => {
    const rA = parseRowNumber(a.row);
    const rB = parseRowNumber(b.row);
    if (rA !== rB) return rA - rB;
    const [lA, nA, sA] = parseBinSortTuple(a.bin);
    const [lB, nB, sB] = parseBinSortTuple(b.bin);
    if (lA !== lB) return lA.localeCompare(lB);
    if (nA !== nB) return nA - nB;
    if (sA !== sB) return sA.localeCompare(sB);
    return a.sku.localeCompare(b.sku);
  });

  return rows.map((r, i) => ({
    step: i + 1,
    sku: r.sku,
    name: r.name,
    row: r.row,
    bin: r.bin,
    quantity: r.qty,
    forOrders: [...r.orders].sort((x, y) => x.localeCompare(y)),
  }));
}

export async function fetchTodaysPickLists(): Promise<{
  dayKey: string;
  timeZone: string;
  batches: TodaysPickListBatch[];
}> {
  const client = await clientPromise;
  const db = client.db(kokobayDbName);
  const now = new Date();
  const dayKey = calendarDateKeyInTz(now, WAREHOUSE_TZ);

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

  const todays: OrderForPick[] = [];
  for (const doc of raw) {
    const createdAt = doc.createdAt instanceof Date ? doc.createdAt : null;
    if (!createdAt || !isOrderOnWarehouseDay(createdAt, dayKey, WAREHOUSE_TZ)) {
      continue;
    }
    todays.push({
      orderNumber: String(doc.orderNumber ?? ""),
      status: String(doc.status ?? "pending"),
      items: (doc.items ?? []) as WarehouseOrderLine[],
    });
  }

  todays.sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));

  const groups = chunkOrders(todays, 5);
  const batches: TodaysPickListBatch[] = groups.map((group, idx) => ({
    batchIndex: idx + 1,
    orderNumbers: group.map((o) => o.orderNumber),
    steps: buildSortedSteps(group),
  }));

  return { dayKey, timeZone: WAREHOUSE_TZ, batches };
}
