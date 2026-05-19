import { DateTime } from "luxon";
import { WAREHOUSE_TZ } from "@/lib/warehouseLondonDay";

/** Calendar days after order date used to estimate delivery / receipt. */
export const ESTIMATED_DELIVERY_DAYS_AFTER_ORDER = 2;

/** Returns must be posted within this many UK working days of estimated receipt. */
export const RETURN_POSTING_WORKING_DAYS = 14;

export const RETURN_WINDOW_EXPIRED_MESSAGE =
  "More than 14 working days have passed since we estimate you received your order. " +
  "Our returns policy only accepts items posted back within 14 working days of delivery, " +
  "so we cannot process this return online. Please contact us if you need help.";

function londonStartOfDay(isoOrDate: string | Date): DateTime | null {
  const dt =
    typeof isoOrDate === "string"
      ? DateTime.fromISO(isoOrDate, { zone: WAREHOUSE_TZ })
      : DateTime.fromJSDate(isoOrDate, { zone: WAREHOUSE_TZ });
  if (!dt.isValid) return null;
  return dt.startOf("day");
}

/**
 * Estimated receipt date in Europe/London: order `created_at` + 3 calendar days.
 */
export function estimatedReceiptLondonDate(orderCreatedAt: string): DateTime | null {
  const orderDay = londonStartOfDay(orderCreatedAt);
  if (!orderDay) return null;
  return orderDay.plus({ days: ESTIMATED_DELIVERY_DAYS_AFTER_ORDER });
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

/**
 * True when today (London) is after the last day the customer can post a return:
 * more than {@link RETURN_POSTING_WORKING_DAYS} UK working days after estimated receipt.
 */
export function isCustomerReturnWindowClosed(
  orderCreatedAt: string,
  now: Date = new Date(),
): boolean {
  const receipt = estimatedReceiptLondonDate(orderCreatedAt);
  if (!receipt) return false;
  const lastAllowedDay = addUkWorkingDays(receipt, RETURN_POSTING_WORKING_DAYS);
  const today = londonStartOfDay(now);
  if (!today) return false;
  return today > lastAllowedDay;
}
