import { DateTime } from "luxon";
import { WAREHOUSE_TZ } from "@/lib/warehouseLondonDay";

/** UK / domestic: days after fulfillment used to estimate receipt when not delivered. */
export const ESTIMATED_TRANSIT_DAYS_DOMESTIC = 3;

/** International: days after fulfillment used to estimate receipt when not delivered. */
export const ESTIMATED_TRANSIT_DAYS_INTERNATIONAL = 7;

/** Returns must be posted within this many UK working days of receipt (delivered or estimated). */
export const RETURN_POSTING_WORKING_DAYS = 14;

export const RETURN_WINDOW_EXPIRED_MESSAGE =
  "More than 14 working days have passed since we estimate you received your order. " +
  "Our returns policy only accepts items posted back within 14 working days of delivery, " +
  "so we cannot process this return online. Please contact us if you need help.";

export type ReturnWindowOrderDates = {
  orderCreatedAt: string;
  /** Carrier / Shopify delivered timestamp when known. */
  deliveredAt?: string | null;
  /** Fulfillment created / shipped timestamp when known. */
  fulfilledAt?: string | null;
  /** True when shipping address is outside the UK. */
  isInternational: boolean;
};

export type ReturnWindowReceiptSource =
  | "delivered"
  | "fulfilled_plus_transit"
  | "created_plus_transit";

function londonStartOfDay(isoOrDate: string | Date): DateTime | null {
  const dt =
    typeof isoOrDate === "string"
      ? DateTime.fromISO(isoOrDate, { zone: WAREHOUSE_TZ })
      : DateTime.fromJSDate(isoOrDate, { zone: WAREHOUSE_TZ });
  if (!dt.isValid) return null;
  return dt.startOf("day");
}

/**
 * Advances `from` by `workingDays` UK weekdays (Mon–Fri), not counting `from` itself.
 */
export function addUkWorkingDays(from: DateTime, workingDays: number): DateTime {
  let current = from.startOf("day");
  let added = 0;
  while (added < workingDays) {
    current = current.plus({ days: 1 });
    if (current.weekday <= 5) added++;
  }
  return current;
}

function transitDays(isInternational: boolean): number {
  return isInternational
    ? ESTIMATED_TRANSIT_DAYS_INTERNATIONAL
    : ESTIMATED_TRANSIT_DAYS_DOMESTIC;
}

/**
 * Receipt date used to start the 14 working-day return window (Europe/London):
 * 1. Delivered date when Shopify/carrier provides it
 * 2. Else fulfilled date + 3 calendar days (UK) or + 7 (international)
 * 3. Else order created date + the same transit days
 */
export function estimatedReceiptLondonDate(
  input: ReturnWindowOrderDates,
): { receipt: DateTime; source: ReturnWindowReceiptSource } | null {
  const delivered = input.deliveredAt
    ? londonStartOfDay(input.deliveredAt)
    : null;
  if (delivered) {
    return { receipt: delivered, source: "delivered" };
  }

  const transit = transitDays(input.isInternational);

  const fulfilled = input.fulfilledAt
    ? londonStartOfDay(input.fulfilledAt)
    : null;
  if (fulfilled) {
    return {
      receipt: fulfilled.plus({ days: transit }),
      source: "fulfilled_plus_transit",
    };
  }

  const created = londonStartOfDay(input.orderCreatedAt);
  if (!created) return null;
  return {
    receipt: created.plus({ days: transit }),
    source: "created_plus_transit",
  };
}

/**
 * True when today (London) is after the last day the customer can post a return:
 * more than {@link RETURN_POSTING_WORKING_DAYS} UK working days after receipt.
 */
export function isCustomerReturnWindowClosed(
  input: ReturnWindowOrderDates,
  now: Date = new Date(),
): boolean {
  const estimated = estimatedReceiptLondonDate(input);
  if (!estimated) return false;
  const lastAllowedDay = addUkWorkingDays(
    estimated.receipt,
    RETURN_POSTING_WORKING_DAYS,
  );
  const today = londonStartOfDay(now);
  if (!today) return false;
  return today > lastAllowedDay;
}
