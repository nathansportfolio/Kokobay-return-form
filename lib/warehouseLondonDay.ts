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

const MONTHS_EN: readonly string[] = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function dayOrdinalEn(n: number): string {
  if (n < 1 || n > 31) return String(n);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

/**
 * Display label for a calendar date, e.g. "4th January" (no year).
 * `dayKey` is YYYY-MM-DD (e.g. Europe/London warehouse `calendarDateKeyInTz`).
 */
export function formatDayKeyAsOrdinalEnglish(dayKey: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey).trim());
  if (!m) return String(dayKey);
  const d = parseInt(m[3], 10);
  const month = parseInt(m[2], 10);
  if (month < 1 || month > 12) return String(dayKey);
  return `${dayOrdinalEn(d)} ${MONTHS_EN[month - 1]}`;
}

/** Same as {@link formatDayKeyAsOrdinalEnglish} for a moment, using that day’s calendar `dayKey` in the zone. */
export function formatDateAsOrdinalInTimeZone(
  when: Date,
  timeZone: string,
): string {
  return formatDayKeyAsOrdinalEnglish(calendarDateKeyInTz(when, timeZone));
}
