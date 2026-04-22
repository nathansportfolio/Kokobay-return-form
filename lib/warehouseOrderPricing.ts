import type { WarehouseOrderLine } from "@/lib/warehouseMockOrders";

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

export function formatGbp(pence: number): string {
  return GBP.format(pence / 100);
}

export function stableFallbackUnitPricePence(sku: string): number {
  let h = 0;
  for (let i = 0; i < sku.length; i++) h = (h * 31 + sku.charCodeAt(i)) | 0;
  return 799 + (Math.abs(h) % 12_001);
}

export function unitPricePenceForLine(line: {
  sku: string;
  unitPricePence?: number;
}): number {
  return typeof line.unitPricePence === "number" && Number.isFinite(line.unitPricePence)
    ? line.unitPricePence
    : stableFallbackUnitPricePence(line.sku);
}

export function orderTotalPence(lines: WarehouseOrderLine[]): number {
  return lines.reduce(
    (sum, line) => sum + unitPricePenceForLine(line) * line.quantity,
    0,
  );
}

export function unitsToPick(lines: WarehouseOrderLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
