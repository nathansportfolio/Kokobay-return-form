/** Lowercase + trim for order preview email comparison. */
export function normalizeEmailForOrderLookup(s: string): string {
  return s.trim().toLowerCase();
}

/** True when the customer-entered email matches the order’s email (case-insensitive). */
export function previewOrderEmailMatches(
  orderEmailFromShopify: string,
  customerEntered: string,
): boolean {
  const a = normalizeEmailForOrderLookup(orderEmailFromShopify);
  const b = normalizeEmailForOrderLookup(customerEntered);
  if (!a || !b) return false;
  return a === b;
}
