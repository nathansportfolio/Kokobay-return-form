/**
 * Pure pick-step / assembly builders from `OrderForPick[]` (no Mongo / Shopify).
 * Used server-side in `fetchTodaysPickLists` and client-side in the walk when
 * an order is paused mid-list.
 */
import { parseDashedProductTitle } from "@/lib/assemblyLineTitle";
import { compareKokobayLocation } from "@/lib/kokobayLocationFormat";
import type {
  OrderAssembly,
  OrderForPick,
  PickStep,
} from "@/lib/picklistShared";
import type { WarehouseOrderLine } from "@/lib/warehouseMockOrders";
import { hexForProductColorName } from "@/lib/warehouseProductColors";

const DEFAULT_LINE_LOCATION = "U-20-F3";

export function lineLocationForPick(line: { location?: string }): string {
  return String(line.location ?? "").trim() || DEFAULT_LINE_LOCATION;
}

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

export function buildSortedStepsFromOrders(orders: OrderForPick[]): PickStep[] {
  type Agg = {
    sku: string;
    name: string;
    location: string;
    qty: number;
    sourceLineItemCount: number;
    orders: Set<string>;
    lineRowsByOrder: Map<string, number>;
    qtyByOrder: Map<string, number>;
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
          prev.qtyByOrder.set(
            on,
            (prev.qtyByOrder.get(on) ?? 0) + line.quantity,
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
        const qtyMap = new Map<string, number>();
        qtyMap.set(ord.orderNumber, line.quantity);
        map.set(key, {
          sku,
          name,
          location,
          qty: line.quantity,
          sourceLineItemCount: 1,
          orders: new Set([ord.orderNumber]),
          lineRowsByOrder: rowsMap,
          qtyByOrder: qtyMap,
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
    const forOrderQuantities = [...r.qtyByOrder.entries()]
      .map(([orderNumber, quantity]) => ({ orderNumber, quantity }))
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
      forOrderQuantities,
      ...(color ? { color } : {}),
      ...(colorHex ? { colorHex } : {}),
      ...(size ? { size } : {}),
      ...(r.thumbnailImageUrl
        ? { thumbnailImageUrl: r.thumbnailImageUrl }
        : {}),
    };
  });
}

export function buildAssemblyFromOrders(orders: OrderForPick[]): OrderAssembly[] {
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
