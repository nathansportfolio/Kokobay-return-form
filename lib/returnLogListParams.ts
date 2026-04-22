import { DateTime } from "luxon";
import type { ReturnLogListOrder, ReturnLogListSort } from "@/lib/returnLog";
import { WAREHOUSE_TZ } from "@/lib/warehouseLondonDay";

export const RETURN_LOG_PAGE_SIZES = [10, 25, 50, 100] as const;
export type ReturnLogPageSize = (typeof RETURN_LOG_PAGE_SIZES)[number];

const PRESET_SET = new Set<"today" | "yesterday" | "7d">([
  "today",
  "yesterday",
  "7d",
]);
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export type ReturnLogDateMode =
  | { kind: "all" }
  | { kind: "preset"; value: "today" | "yesterday" | "7d" }
  | { kind: "custom"; fromYmd: string; toYmd: string };

function ymdOrder(a: string, b: string): { from: string; to: string } {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

function firstString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

const SORT_SET = new Set<ReturnLogListSort>(["date", "email", "refund"]);

function defaultOrderForColumn(sort: ReturnLogListSort): ReturnLogListOrder {
  if (sort === "date") return "desc";
  return "asc";
}

function parseRefundPending(
  sp: Readonly<Record<string, string | string[] | undefined>>,
): boolean {
  const v = firstString(sp.refundPending);
  if (v === undefined) return false;
  const t = v.trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes";
}

function parseReturnLogDate(
  sp: Readonly<Record<string, string | string[] | undefined>>,
): ReturnLogDateMode {
  const from = firstString(sp.from);
  const to = firstString(sp.to);
  if (from && to && YMD.test(from) && YMD.test(to)) {
    const a = DateTime.fromISO(from, { zone: WAREHOUSE_TZ });
    const b = DateTime.fromISO(to, { zone: WAREHOUSE_TZ });
    if (a.isValid && b.isValid) {
      const o = ymdOrder(from, to);
      return { kind: "custom", fromYmd: o.from, toYmd: o.to };
    }
  }

  const pr = firstString(sp.preset);
  if (pr && PRESET_SET.has(pr as "today" | "yesterday" | "7d")) {
    return { kind: "preset", value: pr as "today" | "yesterday" | "7d" };
  }
  return { kind: "all" };
}

export function parseReturnLogListQuery(
  sp: Readonly<Record<string, string | string[] | undefined>>,
): {
  page: number;
  pageSize: ReturnLogPageSize;
  sort: ReturnLogListSort;
  order: ReturnLogListOrder;
  date: ReturnLogDateMode;
  /** `?refundPending=1` — only returns where full refund is not yet marked. */
  refundPending: boolean;
} {
  const pageRaw = Number(firstString(sp.page) ?? 1);
  const page = Math.max(1, Number.isFinite(pageRaw) ? Math.floor(pageRaw) : 1);
  const sizeRaw = Number(firstString(sp.pageSize) ?? 25);
  const pageSize = RETURN_LOG_PAGE_SIZES.includes(sizeRaw as ReturnLogPageSize)
    ? (sizeRaw as ReturnLogPageSize)
    : 25;

  const sortRaw = firstString(sp.sort) ?? "date";
  const sort: ReturnLogListSort = SORT_SET.has(sortRaw as ReturnLogListSort)
    ? (sortRaw as ReturnLogListSort)
    : "date";

  const o = firstString(sp.order);
  const order: ReturnLogListOrder =
    o === "asc" || o === "desc" ? o : defaultOrderForColumn(sort);

  return {
    page,
    pageSize,
    sort,
    order,
    date: parseReturnLogDate(sp),
    refundPending: parseRefundPending(sp),
  };
}

export type ReturnLogListState = {
  page: number;
  pageSize: number;
  sort: ReturnLogListSort;
  order: ReturnLogListOrder;
  date: ReturnLogDateMode;
  refundPending: boolean;
};

function appendReturnLogDateToSearchParams(
  u: URLSearchParams,
  date: ReturnLogDateMode,
) {
  if (date.kind === "all") return;
  if (date.kind === "preset") {
    u.set("preset", date.value);
    return;
  }
  u.set("from", date.fromYmd);
  u.set("to", date.toYmd);
}

function appendRefundPendingToSearchParams(
  u: URLSearchParams,
  refundPending: boolean,
) {
  if (refundPending) u.set("refundPending", "1");
}

export function returnLogListQueryString(
  p: ReturnLogListState,
  patch?: Partial<{
    page: number;
    pageSize: number;
    sort: ReturnLogListSort;
    order: ReturnLogListOrder;
    date: ReturnLogDateMode;
    refundPending: boolean;
  }>,
): string {
  const page = String(patch?.page ?? p.page);
  const pageSize = String(patch?.pageSize ?? p.pageSize);
  const sort = patch?.sort ?? p.sort;
  const order = patch?.order ?? p.order;
  const date: ReturnLogDateMode =
    patch?.date !== undefined ? patch.date : p.date;
  const refundPending: boolean =
    patch?.refundPending !== undefined ? patch.refundPending : p.refundPending;
  const u = new URLSearchParams();
  u.set("page", page);
  u.set("pageSize", pageSize);
  u.set("sort", sort);
  u.set("order", order);
  appendReturnLogDateToSearchParams(u, date);
  appendRefundPendingToSearchParams(u, refundPending);
  return u.toString();
}

const BASE = "/returns/logged";

export function returnLogListHref(
  p: ReturnLogListState,
  patch?: Partial<{
    page: number;
    pageSize: number;
    sort: ReturnLogListSort;
    order: ReturnLogListOrder;
    date: ReturnLogDateMode;
    refundPending: boolean;
  }>,
): string {
  return `${BASE}?${returnLogListQueryString(p, patch)}`;
}

/**
 * Table header: clicking the same column flips `order` and goes to page 1.
 * A different column uses that column’s default `order` and page 1.
 */
export function returnLogListSortHeaderHref(
  current: ReturnLogListState,
  column: ReturnLogListSort,
): string {
  if (current.sort === column) {
    return returnLogListHref(current, {
      page: 1,
      order: current.order === "asc" ? "desc" : "asc",
    });
  }
  return returnLogListHref(current, {
    page: 1,
    sort: column,
    order: defaultOrderForColumn(column),
  });
}

export function returnLogListPageHref(
  current: ReturnLogListState,
  nextPage: number,
): string {
  return returnLogListHref(current, { page: nextPage });
}

export function sortHeaderArrow(
  currentSort: ReturnLogListSort,
  currentOrder: ReturnLogListOrder,
  column: ReturnLogListSort,
): string {
  if (currentSort !== column) return "";
  return currentOrder === "asc" ? " ↑" : " ↓";
}
