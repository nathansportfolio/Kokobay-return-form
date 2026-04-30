export type ReturnLogLineEntry = {
  lineId: string;
  sku: string;
  title: string;
  quantity: number;
  unitPrice: number;
  reason: string | null;
  reasonLabel: string;
  disposition: "restock" | "dispose";
  lineTotalGbp: number;
};

/**
 * A registered return: line-level reasons, then workflow flags (email, refund).
 * Dates are ISO strings when read from the API; `Date` when using the Mongo layer.
 */
export type ReturnLogDoc = {
  returnUid: string;
  orderRef: string;
  /** Shopify REST `order.id` when stored (newer return logs). */
  shopifyOrderId?: string;
  createdAt: string | Date;
  lines: ReturnLogLineEntry[];
  lineCount: number;
  totalRefundGbp: number;
  customerEmailSent: boolean;
  customerEmailSentAt?: string | Date;
  fullRefundIssued: boolean;
  fullRefundAmountGbp?: number;
  fullRefundIssuedAt?: string | Date;
  updatedAt: string | Date;
};

export type ReturnLogListItem = {
  returnUid: string;
  orderRef: string;
  /** Shopify Admin / REST `order.id` for `…/orders/{id}` links. Omitted on older logs. */
  shopifyOrderId?: string;
  createdAt: string;
  updatedAt: string;
  /** Line items (for mobile refund list, etc.). */
  lines: ReturnLogLineEntry[];
  lineCount: number;
  /** Sum of return line totals (expected refund from logged lines). */
  totalRefundGbp: number;
  customerEmailSent: boolean;
  customerEmailSentAt?: string;
  fullRefundIssued: boolean;
  /** Optional recorded amount when refund was marked issued in app. */
  fullRefundAmountGbp?: number;
  fullRefundIssuedAt?: string;
};

/**
 * Pre-filled return UI: from the latest warehouse return log, or from the
 * customer’s online return form (when there is no log yet).
 */
export type ReturnPageResume = {
  source: "returnLog" | "customerForm";
  /** Set when a warehouse return is already registered. */
  returnUid?: string;
  /** Latest customer form row, when `source` is `customerForm`. */
  customerFormSubmissionUid?: string;
  customerEmailSent: boolean;
  fullRefundIssued: boolean;
  byLine: Record<
    string,
    { reason: string | null; disposition: "restock" | "dispose" }
  >;
};

export type InsertReturnLogInput = {
  orderRef: string;
  /** Shopify Admin order resource id; required for correct “View Shopify” from logged list. */
  shopifyOrderId?: string;
  lines: {
    lineId: string;
    sku: string;
    title: string;
    quantity: number;
    unitPrice: number;
    reason: string | null;
    disposition: "restock" | "dispose";
  }[];
};
