/** Distinguish standard “yesterday’s orders” from UK Premium (same day before 2pm). */
export const PICKLIST_LIST_KIND_STANDARD = "standard" as const;
export const PICKLIST_LIST_KIND_UK_PREMIUM = "uk_premium" as const;

export type PicklistListKind =
  | typeof PICKLIST_LIST_KIND_STANDARD
  | typeof PICKLIST_LIST_KIND_UK_PREMIUM;
