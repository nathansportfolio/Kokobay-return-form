import type { KokobayOrderLine } from "@/lib/kokobayOrderLines";
import { mapCustomerFormReasonToWarehouse } from "@/lib/customerFormToWarehouseReturn";
import { getLatestCustomerReturnFormForOrder } from "@/lib/customerReturnFormSubmission";
import { getLatestReturnLogForOrder } from "@/lib/returnLog";
import type { ReturnPageResume } from "@/lib/returnLogTypes";
import {
  getReturnOrderLinesFromProducts,
  getThumbnailsBySkus,
  getUnitPricesBySkus,
} from "@/lib/returnOrderLinesFromProducts";

export type { ReturnPageResume };

/** UI hints for the order return page (which data source we used, if any). */
export type ReturnPageFormContext =
  | { kind: "returnLog" }
  | {
      kind: "customerForm";
      submissionUid: string;
      datePosted: string;
      customerName: string;
      customerEmail: string;
      submittedAtIso: string;
    }
  | { kind: "noFormOnFile" };

/**
 * Loads order lines for the warehouse return flow: latest warehouse return log
 * (if any), else latest customer return form, else a sample of products.
 */
export async function getReturnPageLinesAndResume(
  orderRef: string,
): Promise<{
  lines: KokobayOrderLine[];
  resume: ReturnPageResume | null;
  formContext: ReturnPageFormContext;
}> {
  const key = orderRef.trim();
  if (!key) {
    return { lines: [], resume: null, formContext: { kind: "noFormOnFile" } };
  }

  const last = await getLatestReturnLogForOrder(key);
  if (last?.lines.length) {
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
        source: "returnLog",
        returnUid: last.returnUid,
        customerEmailSent: last.customerEmailSent,
        fullRefundIssued: last.fullRefundIssued,
        byLine,
      },
      formContext: { kind: "returnLog" },
    };
  }

  const form = await getLatestCustomerReturnFormForOrder(key);
  if (form?.items.length) {
    const skus = [...new Set(form.items.map((i) => i.sku))];
    const [thumbs, unitPrices] = await Promise.all([
      getThumbnailsBySkus(skus),
      getUnitPricesBySkus(skus),
    ]);

    const byLine: ReturnPageResume["byLine"] = {};
    const lines: KokobayOrderLine[] = form.items.map((i) => {
      const { reason, disposition } = mapCustomerFormReasonToWarehouse(
        i.reasonValue,
      );
      byLine[i.lineId] = { reason, disposition };
      return {
        id: i.lineId,
        sku: i.sku,
        title: i.title,
        quantity: i.quantity,
        unitPrice: unitPrices.get(i.sku) ?? 0,
        imageUrl: thumbs.get(i.sku) ?? "",
      } satisfies KokobayOrderLine;
    });

    return {
      lines,
      resume: {
        source: "customerForm",
        customerFormSubmissionUid: form.submissionUid,
        customerEmailSent: false,
        fullRefundIssued: false,
        byLine,
      },
      formContext: {
        kind: "customerForm",
        submissionUid: form.submissionUid,
        datePosted: form.datePosted,
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        submittedAtIso: form.createdAt.toISOString(),
      },
    };
  }

  const lines = await getReturnOrderLinesFromProducts(key);
  return {
    lines,
    resume: null,
    formContext: { kind: "noFormOnFile" },
  };
}
