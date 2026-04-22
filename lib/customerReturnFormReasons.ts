/**
 * Standard reason codes for the online customer return form.
 */
export const CUSTOMER_FORM_REASONS = [
  { value: "too_big", label: "Too big" },
  { value: "too_small", label: "Too small" },
  { value: "too_long", label: "Too long" },
  { value: "too_short", label: "Too short" },
  { value: "doesnt_suit", label: "Doesn’t suit me" },
  { value: "incorrect_item", label: "Incorrect item received" },
  { value: "damaged", label: "Damaged" },
  { value: "looks_different", label: "Looks different to website" },
] as const;

export function customerFormReasonLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const r = CUSTOMER_FORM_REASONS.find((o) => o.value === value);
  return r?.label ?? value;
}
