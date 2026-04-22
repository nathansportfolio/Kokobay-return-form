import {
  CUSTOMER_FORM_REASON_UNSET,
  isCustomerFormReturnReasonValue,
} from "@/lib/customerReturnFormReasons";
import { RETURN_REASON_UNSET } from "@/lib/returnReasons";

/**
 * Old warehouse-only codes (pre–customer-form alignment). Map to the closest
 * customer-form option for the shared `<select>`.
 */
const LEGACY_WAREHOUSE_TO_CUSTOMER: Record<string, string> = {
  changed_mind: "doesnt_suit",
  wrong_item: "incorrect_item",
  not_as_described: "looks_different",
  damaged_transit: "damaged",
  defective: "damaged",
  other: "doesnt_suit",
};

/**
 * Value for the customer-form reason `<select>`: customer codes pass through;
 * legacy log codes map; unknown → unset.
 */
export function reasonValueForSharedReturnSelect(
  raw: string | null | undefined,
): string {
  if (raw == null || raw === "" || raw === RETURN_REASON_UNSET) {
    return CUSTOMER_FORM_REASON_UNSET;
  }
  if (isCustomerFormReturnReasonValue(raw)) {
    return raw;
  }
  return LEGACY_WAREHOUSE_TO_CUSTOMER[raw] ?? CUSTOMER_FORM_REASON_UNSET;
}
