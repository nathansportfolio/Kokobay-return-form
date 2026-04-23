import type {
  AssemblyLine,
  OrderAssembly,
  TodaysPickListBatch,
} from "@/lib/fetchTodaysPickLists";
import { formatKokobaySkuDisplay } from "@/lib/skuDisplay";
import { isVariantIdPlaceholderSku } from "@/lib/variantIdPlaceholderSku";

export type OrderLineForLabelPrint = {
  lineIndex: number;
  sku: string;
  /** Empty when the SKU is a placeholder. */
  skuDisplay: string;
  quantity: number;
  name: string;
  color?: string;
};

export type OrderLabelForPrint = {
  orderNumber: string;
  lines: OrderLineForLabelPrint[];
};

export type PickListLabelBatchForPrint = {
  pickListNumber: number;
  batchIndex: number;
  orders: OrderLabelForPrint[];
};

function assemblyLineToPrint(line: AssemblyLine): OrderLineForLabelPrint {
  const sku = String(line.sku ?? "");
  return {
    lineIndex: line.lineIndex,
    sku,
    skuDisplay: isVariantIdPlaceholderSku(sku) ? "" : formatKokobaySkuDisplay(sku),
    quantity: line.quantity,
    name: line.name,
    color: line.color?.trim() || undefined,
  };
}

/**
 * Maps active pick list batches to print rows: for each list, orders in batch
 * order, line items in `lineIndex` (original checkout) order.
 */
export function picklistsToLabelPrintBatches(
  batches: TodaysPickListBatch[],
): PickListLabelBatchForPrint[] {
  return batches.map((b) => {
    const orders: OrderLabelForPrint[] = b.orderNumbers.map((orderNumber) => {
      const a = b.assembly.find((x) => x.orderNumber === orderNumber);
      const rawLines = a?.lines ?? [];
      const lines = [...rawLines]
        .sort((x, y) => x.lineIndex - y.lineIndex)
        .map(assemblyLineToPrint);
      return { orderNumber, lines };
    });
    return {
      pickListNumber: b.displayPickListNumber,
      batchIndex: b.batchIndex,
      orders,
    };
  });
}
