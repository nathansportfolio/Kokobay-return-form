import type { KokobayOrderLine } from "@/lib/kokobayOrderLines";
import type { ReturnPageResume } from "@/lib/returnLogTypes";
import {
  getReturnOrderLinesFromProducts,
  getThumbnailsBySkus,
} from "@/lib/returnOrderLinesFromProducts";
import { getLatestReturnLogForOrder } from "@/lib/returnLog";

export type { ReturnPageResume };

/**
 * If a return was previously logged for this order reference, restore those
 * lines and form state. Otherwise, sample two random products as before.
 */
export async function getReturnPageLinesAndResume(
  orderRef: string,
): Promise<{
  lines: KokobayOrderLine[];
  resume: ReturnPageResume | null;
}> {
  const key = orderRef.trim();
  if (!key) {
    return { lines: [], resume: null };
  }

  const last = await getLatestReturnLogForOrder(key);
  if (!last?.lines.length) {
    const lines = await getReturnOrderLinesFromProducts(key);
    return { lines, resume: null };
  }

  const skus = [...new Set(last.lines.map((l) => l.sku))];
  const thumbs = await getThumbnailsBySkus(skus);

  const lines: KokobayOrderLine[] = last.lines.map((l) => ({
    id: l.lineId,
    sku: l.sku,
    title: l.title,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    imageUrl: thumbs.get(l.sku) ?? "",
  }));

  const byLine: ReturnPageResume["byLine"] = Object.fromEntries(
    last.lines.map((l) => [
      l.lineId,
      { reason: l.reason, disposition: l.disposition },
    ]),
  );

  return {
    lines,
    resume: {
      returnUid: last.returnUid,
      customerEmailSent: last.customerEmailSent,
      fullRefundIssued: last.fullRefundIssued,
      byLine,
    },
  };
}
