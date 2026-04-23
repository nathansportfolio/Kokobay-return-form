const KOKO = "KOKO-";

/**
 * Renders a stock-keeping value for the UI. Prefixes with {@link KOKO} once;
 * if the value already has that prefix (any casing), the label is normalised
 * to `KOKO-` + the remainder.
 */
export function formatKokobaySkuDisplay(
  sku: string | null | undefined,
): string {
  const s = String(sku ?? "").trim();
  if (!s) return "—";
  if (/^koko-/i.test(s)) {
    return `${KOKO}${s.slice(5)}`;
  }
  return `${KOKO}${s}`;
}
