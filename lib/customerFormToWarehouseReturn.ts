/**
 * Map online customer return reasons (packing slip form) to warehouse
 * return-log reason codes and disposition.
 */
export function mapCustomerFormReasonToWarehouse(
  reasonValue: string,
): { reason: string; disposition: "restock" | "dispose" } {
  const v = String(reasonValue).trim();
  if (v === "damaged") {
    return { reason: "damaged_transit", disposition: "dispose" };
  }
  const toReason: Record<string, string> = {
    too_big: "changed_mind",
    too_small: "changed_mind",
    too_long: "changed_mind",
    too_short: "changed_mind",
    doesnt_suit: "changed_mind",
    incorrect_item: "wrong_item",
    looks_different: "not_as_described",
  };
  return { reason: toReason[v] ?? "other", disposition: "restock" };
}
