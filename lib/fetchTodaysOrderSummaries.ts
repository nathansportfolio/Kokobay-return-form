import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import type { WarehouseOrderLine } from "@/lib/warehouseMockOrders";
import {
  formatGbp,
  orderTotalPence,
  unitsToPick,
} from "@/lib/warehouseOrderPricing";
import { getCompletedOrderNumbersSetForDay } from "@/lib/completedPicklist";
import { getPausedOrderNumbersSetForPicklistContext } from "@/lib/orderPickPause";
import { PICKLIST_LIST_KIND_STANDARD } from "@/lib/picklistListKind";
import {
  getTodaysShopifyOrderForPicks,
  isShopifyWarehouseDataEnabled,
} from "@/lib/shopifyWarehouseDayOrders";
import { formatKokobaySkuDisplay } from "@/lib/skuDisplay";
import {
  WAREHOUSE_TZ,
  calendarDateKeyInTz,
  getPickListOrderDayKey,
  isOrderOnWarehouseDay,
} from "@/lib/warehouseLondonDay";

/** Which warehouse calendar day the summaries refer to. */
export type OrderSummariesDayMode = "calendar" | "pickList";

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
  /** True when this order is paused (missing stock at bin) for this warehouse day — excluded from active picks. */
  pausedMissingStock: boolean;
};

function buildPickPreview(items: WarehouseOrderLine[], maxParts = 3): string {
  if (items.length === 0) return "—";
  const parts = items
    .slice(0, maxParts)
    .map(
      (l) => `${formatKokobaySkuDisplay(l.sku)} ×${l.quantity}`,
    );
  const rest = items.length - maxParts;
  if (rest > 0) parts.push(`+${rest} more`);
  return parts.join(" · ");
}

/**
 * @param dayMode
 *   - `calendar` — current London warehouse day (e.g. `/orders/today`).
 *   - `pickList` — day whose orders the pick list walks (**yesterday** in London: ship today, pick orders from the prior day).
 */
export async function fetchTodaysOrderSummaries(
  dayMode: OrderSummariesDayMode = "calendar",
): Promise<{
  dayKey: string;
  orders: TodaysOrderSummary[];
  /** `shopify` when `SHOPIFY_STORE` is set; `sample` is legacy Mongo `orders` seed. */
  dataSource: "shopify" | "sample";
}> {
  const dayKey =
    dayMode === "pickList"
      ? getPickListOrderDayKey()
      : calendarDateKeyInTz(new Date(), WAREHOUSE_TZ);
  const [pickedSet, pausedSet] = await Promise.all([
    getCompletedOrderNumbersSetForDay(dayKey),
    getPausedOrderNumbersSetForPicklistContext(
      dayKey,
      PICKLIST_LIST_KIND_STANDARD,
    ),
  ]);

  if (isShopifyWarehouseDataEnabled()) {
    const forPick = await getTodaysShopifyOrderForPicks(dayKey);
    const orders: TodaysOrderSummary[] = forPick.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      lineCount: o.items.length,
      unitsToPick: unitsToPick(o.items),
      totalFormatted: formatGbp(orderTotalPence(o.items)),
      pickPreview: buildPickPreview(o.items),
      picked: pickedSet.has(o.orderNumber),
      pausedMissingStock: pausedSet.has(o.orderNumber),
    }));
    return { dayKey, orders, dataSource: "shopify" };
  }

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
      pausedMissingStock: pausedSet.has(orderNumber),
    });
  }

  return { dayKey, orders, dataSource: "sample" };
}
