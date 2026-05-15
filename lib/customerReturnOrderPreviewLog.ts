/**
 * Order preview lookup logging for `/api/returns/preview-order`.
 *
 * **Server:** always emits structured JSON lines — grep for `[kokobay-returns-preview-order]`.
 * **Browser:** logs only when `NODE_ENV === "development"` or
 * `NEXT_PUBLIC_RETURNS_ORDER_LOOKUP_DEBUG=1` (useful on a screen share with a customer).
 */

export const RETURN_ORDER_PREVIEW_LOG_NS = "kokobay-returns-preview-order";

export type OrderQueryDiagnostics = {
  length: number;
  hasLeadingHash: boolean;
  longNumericAdminId: boolean;
  shortNumericOrderNumber: boolean;
  onlyDigits: boolean;
};

export function queryDiagnosticsForOrderString(
  orderTrimmed: string,
): OrderQueryDiagnostics {
  const t = orderTrimmed.trim();
  return {
    length: t.length,
    hasLeadingHash: t.startsWith("#"),
    longNumericAdminId: /^\d{10,}$/.test(t),
    shortNumericOrderNumber: /^\d{1,9}$/.test(t),
    onlyDigits: /^\d+$/.test(t),
  };
}

export function isReturnsOrderLookupClientDebugEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_RETURNS_ORDER_LOOKUP_DEBUG === "1"
  );
}

export function logReturnsOrderLookupClient(
  phase: string,
  payload: Record<string, unknown>,
): void {
  if (!isReturnsOrderLookupClientDebugEnabled()) return;
  console.info(`[${RETURN_ORDER_PREVIEW_LOG_NS} client]`, phase, {
    ts: new Date().toISOString(),
    ...payload,
  });
}

export function logReturnOrderPreview(
  level: "info" | "warn" | "error",
  phase: string,
  payload: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    ns: RETURN_ORDER_PREVIEW_LOG_NS,
    level,
    phase,
    ts: new Date().toISOString(),
    ...payload,
  });
  if (level === "error") {
    console.error(`[${RETURN_ORDER_PREVIEW_LOG_NS}]`, line);
  } else if (level === "warn") {
    console.warn(`[${RETURN_ORDER_PREVIEW_LOG_NS}]`, line);
  } else {
    console.info(`[${RETURN_ORDER_PREVIEW_LOG_NS}]`, line);
  }
}
