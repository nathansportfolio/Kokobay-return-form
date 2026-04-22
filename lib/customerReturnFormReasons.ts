/**
 * Standard reason codes for the online customer return form and warehouse
 * return screen — keep them in sync.
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

/** Unset / placeholder (same as online form — must not be a real reason `value`). */
export const CUSTOMER_FORM_REASON_UNSET = "" as const;

/** First row + all reasons; use for `<select>` in both customer and warehouse UIs. */
export const CUSTOMER_FORM_REASON_SELECT_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: CUSTOMER_FORM_REASON_UNSET, label: "Select a reason" },
  ...CUSTOMER_FORM_REASONS,
];

export function isCustomerFormReturnReasonValue(value: string): boolean {
  return CUSTOMER_FORM_REASONS.some((o) => o.value === value);
}

export function customerFormReasonLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const r = CUSTOMER_FORM_REASONS.find((o) => o.value === value);
  return r?.label ?? value;
}
