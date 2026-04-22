/** Non-empty sentinel — iOS Safari can mis-handle `<option value="">` in controlled selects. */
export const RETURN_REASON_UNSET = "__none__" as const;

export const RETURN_REASONS = [
  { value: RETURN_REASON_UNSET, label: "Choose a reason…" },
  { value: "changed_mind", label: "Changed mind" },
  { value: "wrong_item", label: "Wrong item sent" },
  { value: "not_as_described", label: "Not as described" },
  { value: "damaged_transit", label: "Damaged in transit" },
  { value: "defective", label: "Faulty / defective" },
  { value: "other", label: "Other" },
] as const;
