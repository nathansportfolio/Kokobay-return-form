import type { KokobayOrderLine } from "@/lib/kokobayOrderLines";
import {
  normalizeReturnLineDisposition,
  type ReturnLineDisposition,
} from "@/lib/returnLogTypes";

/**
 * “Return to sender” and “Wrong item received” are excluded from the customer
 * refund total (Klaviyo amount + “Refund value” on the warehouse return form).
 */
export function dispositionCountsTowardCustomerRefund(
  d: ReturnLineDisposition,
): boolean {
  return d !== "return_to_sender" && d !== "wrong_item_received";
}

export function refundableLineTotalGbp(
  quantity: number,
  unitPrice: number,
  disposition: ReturnLineDisposition,
): number {
  if (!dispositionCountsTowardCustomerRefund(disposition)) return 0;
  return Math.round(quantity * unitPrice * 100) / 100;
}

type LineUiState = {
  selected?: boolean;
  disposition?: ReturnLineDisposition;
};

/** Sum of refundable totals for lines currently ticked on the return form. */
export function sumRefundableTotalSelectedLinesGbp(
  lines: KokobayOrderLine[],
  byId: Record<string, LineUiState | undefined>,
): number {
  let total = 0;
  for (const line of lines) {
    const s = byId[line.id];
    if (!s?.selected) continue;
    const disp = normalizeReturnLineDisposition(s.disposition);
    total += refundableLineTotalGbp(line.quantity, line.unitPrice, disp);
  }
  return Math.round(total * 100) / 100;
}
