import type { WarehouseOrderLine } from "@/lib/warehouseMockOrders";

/** Used by client and server — do not import Mongo/Shopify here (keeps client bundle clean). */

export const DEFAULT_ORDERS_PER_PICK_LIST = 4;
const MIN_ORDERS_PER_PICK = 1;
const MAX_ORDERS_PER_PICK = 10;

export const DEFAULT_ITEMS_PER_PICK_LIST = 8;
const MIN_ITEMS_PER_PICK = 1;
const MAX_ITEMS_PER_PICK = 100;

export function parseOrdersPerListParam(
  raw: string | string[] | undefined,
): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(String(s ?? ""), 10);
  if (Number.isNaN(n)) return DEFAULT_ORDERS_PER_PICK_LIST;
  return Math.min(MAX_ORDERS_PER_PICK, Math.max(MIN_ORDERS_PER_PICK, n));
}

export function clampOrdersPerList(n: number): number {
  if (Number.isNaN(n) || n < MIN_ORDERS_PER_PICK) {
    return DEFAULT_ORDERS_PER_PICK_LIST;
  }
  return Math.min(
    MAX_ORDERS_PER_PICK,
    Math.max(MIN_ORDERS_PER_PICK, Math.floor(n)),
  );
}

export function parseItemsPerListParam(
  raw: string | string[] | undefined,
): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(String(s ?? ""), 10);
  if (Number.isNaN(n)) return DEFAULT_ITEMS_PER_PICK_LIST;
  return Math.min(MAX_ITEMS_PER_PICK, Math.max(MIN_ITEMS_PER_PICK, n));
}

export function clampItemsPerList(n: number): number {
  if (Number.isNaN(n) || n < MIN_ITEMS_PER_PICK) {
    return DEFAULT_ITEMS_PER_PICK_LIST;
  }
  return Math.min(
    MAX_ITEMS_PER_PICK,
    Math.max(MIN_ITEMS_PER_PICK, Math.floor(n)),
  );
}

/** Sum of pickable line quantities; matches “Total items (qty)” for one order. */
export function itemUnitsForOrder(o: OrderForPick): number {
  let s = 0;
  for (const line of o.items) {
    s += Math.max(0, Math.trunc(line.quantity || 0));
  }
  return s;
}

export type OrderForPick = {
  orderNumber: string;
  status: string;
  items: WarehouseOrderLine[];
  /** When source is Shopify; used on assembly. */
  customerFirstName?: string;
  customerLastName?: string;
};

/** Per contributing order line merged into one pick stop (same bin + SKU). */
export type PickStepLineSourceMeta = {
  orderNumber: string;
  quantity: number;
  shopifyLineItemId?: number;
  shopifyVariantId?: number;
  shopifyProductId?: number;
  unitPricePence?: number;
};

export type PickStepMeta = {
  sources: PickStepLineSourceMeta[];
};

export type PickStep = {
  step: number;
  sku: string;
  name: string;
  location: string;
  quantity: number;
  /**
   * How many order line rows (after pickable filter) are merged into this
   * stop. Omitted/1 when a single line; > 1 when the same `location` +
   * `SKU` appears on multiple order lines. New builds set this; older
   * archived data may omit it.
   */
  sourceLineItemCount?: number;
  forOrders: string[];
  /**
   * For this stop, how many **order line rows** each order contributes (one
   * per product line, before merging into total Qty). E.g. top + bottoms on
   * one order with the same SKU → that order has `lineRows: 2`.
   */
  forOrderLineRowCounts?: { orderNumber: string; lineRows: number }[];
  /**
   * Units at this stop per order (sums of merged line quantities). Used when
   * pausing a pick for “no stock at bin” so each order’s short qty is known.
   */
  forOrderQuantities?: { orderNumber: string; quantity: number }[];
  /** Product colour for this stop (merged with " · " if several lines differ). */
  color?: string;
  /**
   * Suggested map fill for a **single** distinct colour on this stop; omitted
   * when merged/unknown → UI shows a rainbow swatch.
   */
  colorHex?: string;
  /** Product thumbnail URL from the order line (e.g. Unsplash mock). */
  thumbnailImageUrl?: string;
  /**
   * Size for this stop (merged with " · " if several lines differ). Filled
   * from `WarehouseOrderLine.size` and dashed titles; not in older archives.
   */
  size?: string;
  /**
   * Shopify ids and per-line qty for debugging / support. Omitted on older
   * builds and mock-only orders.
   */
  meta?: PickStepMeta;
};

/** Validates optional `PickStep.meta` on API bodies (complete / pause). */
export function pickStepMetaIsValid(meta: unknown): boolean {
  if (meta === undefined) {
    return true;
  }
  if (!meta || typeof meta !== "object") {
    return false;
  }
  const m = meta as Record<string, unknown>;
  if (!Array.isArray(m.sources)) {
    return false;
  }
  for (const row of m.sources) {
    if (!row || typeof row !== "object") {
      return false;
    }
    const e = row as Record<string, unknown>;
    if (typeof e.orderNumber !== "string") {
      return false;
    }
    if (typeof e.quantity !== "number" || !Number.isFinite(e.quantity)) {
      return false;
    }
    for (const k of [
      "shopifyLineItemId",
      "shopifyVariantId",
      "shopifyProductId",
      "unitPricePence",
    ] as const) {
      if (e[k] !== undefined) {
        if (typeof e[k] !== "number" || !Number.isFinite(e[k] as number)) {
          return false;
        }
      }
    }
  }
  return true;
}

export type AssemblyLine = {
  /** 1-based line order within the order (for packing). */
  lineIndex: number;
  sku: string;
  quantity: number;
  name: string;
  color?: string;
  colorHex?: string;
  /** From Shopify variant (e.g. `Apricot / 10` → `10`) when the title has no size. */
  size?: string;
  thumbnailImageUrl?: string;
};

export type OrderAssembly = {
  orderNumber: string;
  customerFirstName?: string;
  customerLastName?: string;
  lines: AssemblyLine[];
};

export type TodaysPickListBatch = {
  /**
   * 1-based index of this list among *active* lists only. Used in URLs (`?list=`).
   */
  batchIndex: number;
  /**
   * 1-based pick for the whole warehouse day, counting completed work earlier in the day.
   * (e.g. 4 already archived → the next active list is 5.)
   */
  displayPickListNumber: number;
  orderNumbers: string[];
  /** Full batch orders (same as pick list); used to rebuild steps when pausing one order mid-walk. */
  orders: OrderForPick[];
  steps: PickStep[];
  /** Original line order per order — use when assembling after the pick walk. */
  assembly: OrderAssembly[];
};

/**
 * “For” line on a pick step: when one order has several lines that merged
 * (same location + SKU), show how many (e.g. `… (2 product lines) …`). Multiple
 * orders get ` · ` between, each with a count if > 1.
 */
export function pickStepForOrdersLabel(s: PickStep): string {
  const list = s.forOrderLineRowCounts;
  if (!list?.length) {
    return s.forOrders.join(", ");
  }
  return list
    .map(({ orderNumber, lineRows }) =>
      lineRows > 1
        ? `${orderNumber} (${lineRows} product lines)`
        : orderNumber
    )
    .join(" · ");
}
