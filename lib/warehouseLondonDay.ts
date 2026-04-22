export const WAREHOUSE_TZ = "Europe/London";

export function calendarDateKeyInTz(iso: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(iso);
}

export function isOrderOnWarehouseDay(
  createdAt: Date,
  dayKey: string,
  timeZone: string,
): boolean {
  return calendarDateKeyInTz(createdAt, timeZone) === dayKey;
}
