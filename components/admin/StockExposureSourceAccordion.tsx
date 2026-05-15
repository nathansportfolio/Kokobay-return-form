"use client";

import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { StockExposureBySourceRow } from "@/lib/stockExposureAnalytics";
import { shopifyOnlineStoreProductUrl } from "@/lib/shopifyOrderAdminUrl";

function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-GB").format(Math.round(n));
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

type SourceSortKey =
  | "source"
  | "totalViews"
  | "outOfStockViews"
  | "outOfStockRate"
  | "lowStockViews"
  | "lowStockRate"
  | "healthyRate";

type SortDir = "asc" | "desc";

const HEADER_GRID =
  "grid grid-cols-[minmax(0,1.1fr)_4.25rem_4rem_3.25rem_4rem_3.25rem_3.5rem_minmax(4.5rem,auto)] items-center gap-x-2 px-3 py-2.5 text-sm";

function sortValue(row: StockExposureBySourceRow, key: SourceSortKey): string | number {
  switch (key) {
    case "source":
      return row.source.toLowerCase();
    case "totalViews":
      return row.totalViews;
    case "outOfStockViews":
      return row.outOfStockViews;
    case "outOfStockRate":
      return row.outOfStockRate;
    case "lowStockViews":
      return row.lowStockViews;
    case "lowStockRate":
      return row.lowStockRate;
    case "healthyRate":
      return row.healthyRate;
    default:
      return 0;
  }
}

function compareRows(
  a: StockExposureBySourceRow,
  b: StockExposureBySourceRow,
  key: SourceSortKey,
  dir: SortDir,
): number {
  const va = sortValue(a, key);
  const vb = sortValue(b, key);
  let cmp: number;
  if (typeof va === "string" && typeof vb === "string") {
    cmp = va.localeCompare(vb, "en");
  } else {
    cmp = Number(va) - Number(vb);
  }
  return dir === "asc" ? cmp : -cmp;
}

function SortHeader({
  label,
  colKey,
  activeKey,
  activeDir,
  onSort,
  align = "end",
  toneClass = "",
}: {
  label: ReactNode;
  colKey: SourceSortKey;
  activeKey: SourceSortKey;
  activeDir: SortDir;
  onSort: (key: SourceSortKey) => void;
  align?: "start" | "end";
  toneClass?: string;
}) {
  const active = activeKey === colKey;
  const justify = align === "end" ? "justify-end" : "justify-start";
  const textAlign = align === "end" ? "text-right" : "text-left";
  return (
    <button
      type="button"
      className={`group flex w-full min-w-0 items-center gap-0.5 ${justify} rounded-md px-0.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-foreground outline-none ring-offset-2 transition-colors hover:bg-zinc-200/80 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:hover:bg-zinc-800/80 dark:focus-visible:ring-zinc-500 ${textAlign} ${toneClass}`}
      onClick={() => onSort(colKey)}
      aria-sort={
        active ? (activeDir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <span className="min-w-0 leading-tight">{label}</span>
      <span className="inline-flex shrink-0 flex-col text-zinc-400 dark:text-zinc-500">
        {active ? (
          activeDir === "asc" ? (
            <CaretUp className="size-3.5" weight="bold" aria-hidden />
          ) : (
            <CaretDown className="size-3.5" weight="bold" aria-hidden />
          )
        ) : (
          <CaretDown
            className="size-3.5 opacity-0 transition-opacity group-hover:opacity-40"
            weight="bold"
            aria-hidden
          />
        )}
      </span>
    </button>
  );
}

export function StockExposureSourceAccordion({
  rows,
}: {
  rows: StockExposureBySourceRow[];
}) {
  const [openSource, setOpenSource] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SourceSortKey; dir: SortDir }>({
    key: "outOfStockRate",
    dir: "desc",
  });

  const toggle = useCallback((source: string) => {
    setOpenSource((cur) => (cur === source ? null : source));
  }, []);

  const onSort = useCallback((key: SourceSortKey) => {
    setSort((s) => {
      if (s.key === key) {
        return { key, dir: s.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: key === "source" ? "asc" : "desc" };
    });
  }, []);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => compareRows(a, b, sort.key, sort.dir));
    return copy;
  }, [rows, sort]);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">No attributed traffic.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
        Click a column heading to sort. Click again to reverse (e.g. Low views low →
        high, then high → low).
      </p>
      <div className="min-w-[46rem] overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950/40">
        <div
          className={`${HEADER_GRID} border-b border-zinc-200 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/50`}
        >
          <SortHeader
            label="Source"
            colKey="source"
            activeKey={sort.key}
            activeDir={sort.dir}
            onSort={onSort}
            align="start"
          />
          <SortHeader
            label="Views"
            colKey="totalViews"
            activeKey={sort.key}
            activeDir={sort.dir}
            onSort={onSort}
          />
          <SortHeader
            label="OOS views"
            colKey="outOfStockViews"
            activeKey={sort.key}
            activeDir={sort.dir}
            onSort={onSort}
            toneClass="text-rose-700 dark:text-rose-300"
          />
          <SortHeader
            label="OOS %"
            colKey="outOfStockRate"
            activeKey={sort.key}
            activeDir={sort.dir}
            onSort={onSort}
          />
          <SortHeader
            label="Low views"
            colKey="lowStockViews"
            activeKey={sort.key}
            activeDir={sort.dir}
            onSort={onSort}
            toneClass="text-amber-800 dark:text-amber-200/90"
          />
          <SortHeader
            label="Low %"
            colKey="lowStockRate"
            activeKey={sort.key}
            activeDir={sort.dir}
            onSort={onSort}
          />
          <SortHeader
            label="Healthy %"
            colKey="healthyRate"
            activeKey={sort.key}
            activeDir={sort.dir}
            onSort={onSort}
          />
          <span className="text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Expand
          </span>
        </div>
        {sortedRows.map((r) => {
          const open = openSource === r.source;
          const panelId = `source-products-${encodeURIComponent(r.source)}`;
          return (
            <div
              key={r.source}
              className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/80"
            >
              <button
                type="button"
                id={`source-trigger-${encodeURIComponent(r.source)}`}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggle(r.source)}
                className={`${HEADER_GRID} w-full cursor-pointer text-left text-zinc-800 transition-colors hover:bg-zinc-100/90 dark:text-zinc-200 dark:hover:bg-zinc-800/50`}
              >
                <span
                  className="min-w-0 truncate font-medium text-foreground"
                  title={r.source}
                >
                  {r.source}
                </span>
                <span className="text-right tabular-nums">{fmtInt(r.totalViews)}</span>
                <span className="text-right tabular-nums text-rose-700 dark:text-rose-300">
                  {fmtInt(r.outOfStockViews)}
                </span>
                <span className="text-right tabular-nums text-rose-700 dark:text-rose-300">
                  {fmtPct(r.outOfStockRate)}
                </span>
                <span className="text-right tabular-nums text-amber-800 dark:text-amber-200/90">
                  {fmtInt(r.lowStockViews)}
                </span>
                <span className="text-right tabular-nums text-amber-800 dark:text-amber-200/90">
                  {fmtPct(r.lowStockRate)}
                </span>
                <span className="text-right tabular-nums text-emerald-800 dark:text-emerald-300/90">
                  {fmtPct(r.healthyRate)}
                </span>
                <span className="flex items-center justify-end gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  <span className="hidden sm:inline">{open ? "Hide" : "Show"}</span>
                  <CaretDown
                    className={`size-[1.125rem] shrink-0 transition-transform duration-200 ${
                      open ? "rotate-180" : ""
                    }`}
                    weight="bold"
                    aria-hidden
                  />
                </span>
              </button>
              {open ? (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={`source-trigger-${encodeURIComponent(r.source)}`}
                  className="border-t border-zinc-100 bg-zinc-50/60 px-3 py-3 dark:border-zinc-800/80 dark:bg-zinc-900/30"
                >
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Products ranked by views from this source, only counting page views
                    where summed variant inventory was under 10 units (latest snapshot in
                    the range per product).
                  </p>
                  {r.topProducts.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      No views from this source while inventory was under 10 units in
                      this range.
                    </p>
                  ) : (
                    <ol className="mt-2 space-y-2">
                      {r.topProducts.map((p, i) => {
                        const href = shopifyOnlineStoreProductUrl(p.handle);
                        return (
                          <li
                            key={`${r.source}-${p.handle}-${i}`}
                            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
                          >
                            <span className="w-5 shrink-0 tabular-nums text-zinc-400 dark:text-zinc-500">
                              {i + 1}.
                            </span>
                            {p.handle && href !== "#" ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="min-w-0 flex-1 font-medium text-zinc-800 underline-offset-2 hover:underline dark:text-zinc-100"
                              >
                                {p.title}
                              </a>
                            ) : (
                              <span className="min-w-0 flex-1 font-medium text-zinc-800 dark:text-zinc-100">
                                {p.title}
                              </span>
                            )}
                            <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
                              {fmtInt(p.views)} views · {fmtInt(p.totalStock)} stock
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
