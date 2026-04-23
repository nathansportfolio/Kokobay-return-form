import type { WarehouseOrderLine } from "@/lib/warehouseMockOrders";

/**
 * Titles that are *only* shipping / fee pseudo-lines (e.g. “Free postage”) and
 * should not appear in pick walks or assembly, even if the store left
 * `requires_shipping: true` on a £0 add-on.
 */
const SHIPPING_ONLY_TITLE = /^(?:free\s+)?(?:postage|post|shipping|standard shipping|next(?:\s*|-)day(?:\s+(?:delivery|shipping))?|delivery|collection|pickup|local pickup)(?:\s+fee|\s+charge)?$/i;

/**
 * @returns false for digital-only lines, and common £0 “postage / shipping”
 *   products that are not racked stock.
 */
export function isPickableWarehouseLine(line: WarehouseOrderLine): boolean {
  if (line.requiresShipping === false) return false;

  const title = (line.name ?? "").trim();
  if (!title) return true;
  if (title.length <= 64 && SHIPPING_ONLY_TITLE.test(title)) {
    return false;
  }
  if (
    line.unitPricePence === 0 &&
    isLikelyPostageOrShippingByTitleHeuristic(title)
  ) {
    return false;
  }
  return true;
}

/**
 * Catches “free post”, “1st class postage”, “tracked delivery” style lines
 * with £0 line value when the strict regex is too tight.
 */
function isLikelyPostageOrShippingByTitleHeuristic(title: string): boolean {
  const t = title.toLowerCase();
  if (t.length > 100) return false;
  if (/\bpostage\s*&\s*packaging\b/.test(t) && t.length < 50) return true;
  if (
    /^(1st|2nd|first|second|next)\b.*\b(class|class delivery|delivery)\b/i.test(
      t,
    ) &&
    t.length < 50
  ) {
    return true;
  }
  if (/^(uk\s+)?(standard|tracked|recorded|special)\s+delivery$/.test(t)) {
    return true;
  }
  return false;
}

export function withPickableLinesOnly(orders: {
  orderNumber: string;
  status: string;
  items: WarehouseOrderLine[];
}[]): { orderNumber: string; status: string; items: WarehouseOrderLine[] }[] {
  return orders
    .map((o) => ({
      ...o,
      items: o.items.filter(isPickableWarehouseLine),
    }))
    .filter((o) => o.items.length > 0);
}
