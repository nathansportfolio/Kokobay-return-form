import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import type { WarehouseOrderLine } from "@/lib/warehouseMockOrders";
import {
  formatGbp,
  orderTotalPence,
  unitsToPick,
} from "@/lib/warehouseOrderPricing";
import { getCompletedOrderNumbersSetForDay } from "@/lib/completedPicklist";
import {
  WAREHOUSE_TZ,
  calendarDateKeyInTz,
  isOrderOnWarehouseDay,
} from "@/lib/warehouseLondonDay";

export type TodaysOrderSummary = {
  orderNumber: string;
  status: string;
  lineCount: number;
  unitsToPick: number;
  totalFormatted: string;
  /** Short text for “what to pick”, not the full BOM. */
  pickPreview: string;
  /** `true` if this order was included in a completed pick for this warehouse day. */
  picked: boolean;
};

function buildPickPreview(items: WarehouseOrderLine[], maxParts = 3): string {
  if (items.length === 0) return "—";
  const parts = items.slice(0, maxParts).map((l) => `${l.sku} ×${l.quantity}`);
  const rest = items.length - maxParts;
  if (rest > 0) parts.push(`+${rest} more`);
  return parts.join(" · ");
}

export async function fetchTodaysOrderSummaries(): Promise<{
  dayKey: string;
  orders: TodaysOrderSummary[];
}> {
  const client = await clientPromise;
  const db = client.db(kokobayDbName);
  const now = new Date();
  const dayKey = calendarDateKeyInTz(now, WAREHOUSE_TZ);
  const pickedSet = await getCompletedOrderNumbersSetForDay(dayKey);

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
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();

  const orders: TodaysOrderSummary[] = [];

  for (const doc of raw) {
    const createdAt = doc.createdAt instanceof Date ? doc.createdAt : null;
    if (!createdAt || !isOrderOnWarehouseDay(createdAt, dayKey, WAREHOUSE_TZ)) {
      continue;
    }

    const items = (doc.items ?? []) as WarehouseOrderLine[];
    const orderNumber = String(doc.orderNumber ?? "");
    const status = String(doc.status ?? "—");

    orders.push({
      orderNumber,
      status,
      lineCount: items.length,
      unitsToPick: unitsToPick(items),
      totalFormatted: formatGbp(orderTotalPence(items)),
      pickPreview: buildPickPreview(items),
      picked: pickedSet.has(orderNumber),
    });
  }

  return { dayKey, orders };
}
