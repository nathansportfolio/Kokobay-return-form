import { DateTime } from "luxon";
import { WAREHOUSE_TZ } from "@/lib/warehouseLondonDay";

import type { ReturnLogDateMode } from "@/lib/returnLogListParams";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function validYmd(s: string): boolean {
  if (!YMD.test(s)) return false;
  const d = DateTime.fromISO(s, { zone: WAREHOUSE_TZ });
  return d.isValid;
}

/**
 * Inclusive `createdAt` range in UTC for Mongo, aligned to Europe/London calendar days.
 * Returns `null` when the filter is "all time".
 */
export function returnLogDateBounds(
  date: ReturnLogDateMode,
): { gte: Date; lte: Date } | null {
  if (date.kind === "all") return null;
  const z = WAREHOUSE_TZ;
  if (date.kind === "custom") {
    if (!validYmd(date.fromYmd) || !validYmd(date.toYmd)) return null;
    const from = DateTime.fromISO(date.fromYmd, { zone: z }).startOf("day");
    const to = DateTime.fromISO(date.toYmd, { zone: z }).endOf("day");
    if (!from.isValid || !to.isValid) return null;
    if (to < from) {
      const t = to;
      return { gte: t.startOf("day").toJSDate(), lte: from.endOf("day").toJSDate() };
    }
    return { gte: from.toJSDate(), lte: to.toJSDate() };
  }
  const now = DateTime.now().setZone(z);
  if (date.value === "today") {
    return {
      gte: now.startOf("day").toJSDate(),
      lte: now.endOf("day").toJSDate(),
    };
  }
  if (date.value === "yesterday") {
    const y = now.minus({ days: 1 });
    return {
      gte: y.startOf("day").toJSDate(),
      lte: y.endOf("day").toJSDate(),
    };
  }
  if (date.value === "7d") {
    return {
      gte: now.minus({ days: 6 }).startOf("day").toJSDate(),
      lte: now.endOf("day").toJSDate(),
    };
  }
  return null;
}
