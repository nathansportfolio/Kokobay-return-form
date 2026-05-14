import Link from "next/link";
import type {
  StockExposureAnalytics,
  StockExposureBySourceRow,
  StockExposureDailyTrendRow,
  StockExposureRange,
} from "@/lib/stockExposureAnalytics";
import { shopifyOnlineStoreProductUrl } from "@/lib/shopifyOrderAdminUrl";
import { WAREHOUSE_TZ } from "@/lib/warehouseLondonDay";

const RANGE_OPTIONS: { value: StockExposureRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Past 7 days" },
  { value: "30d", label: "Past 30 days" },
  { value: "all", label: "All time" },
];

function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-GB").format(Math.round(n));
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "zinc" | "rose" | "amber" | "emerald";
}) {
  const border =
    tone === "rose"
      ? "border-l-rose-600/90"
      : tone === "amber"
        ? "border-l-amber-500/90"
        : tone === "emerald"
          ? "border-l-emerald-600/90"
          : "border-l-zinc-500/80";
  return (
    <div
      className={`flex min-h-0 flex-col rounded-xl border border-zinc-200 border-l-4 bg-zinc-50/90 p-4 dark:border-zinc-700 dark:bg-zinc-900/50 ${border}`}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-foreground">
        {value}
      </span>
      {sub ? (
        <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{sub}</span>
      ) : null}
    </div>
  );
}

function ExposurePie({ data }: { data: StockExposureAnalytics }) {
  const { totals } = data;
  const t = Math.max(1, totals.totalViews);
  const oDeg = (totals.outOfStockViews / t) * 360;
  const lDeg = (totals.lowStockViews / t) * 360;
  const hDeg = Math.max(0, 360 - oDeg - lDeg);
  const a1 = oDeg;
  const a2 = oDeg + lDeg;
  const a3 = oDeg + lDeg + hDeg;
  const bg =
    totals.totalViews === 0
      ? "conic-gradient(rgb(161 161 170) 0deg 360deg)"
      : `conic-gradient(
          rgb(225 29 72) 0deg ${a1}deg,
          rgb(245 158 11) ${a1}deg ${a2}deg,
          rgb(22 163 74) ${a2}deg ${a3}deg
        )`;
  const { outOfStockRate, lowStockRate, healthyRate } = data.percentages;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-8">
      <div
        className="h-40 w-40 shrink-0 rounded-full border border-zinc-200 shadow-inner dark:border-zinc-600"
        style={{ background: bg }}
        role="img"
        aria-label={`Exposure: ${fmtPct(healthyRate)} healthy, ${fmtPct(lowStockRate)} low stock, ${fmtPct(outOfStockRate)} out of stock`}
      />
      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-sm bg-rose-600" />
          <span className="text-zinc-600 dark:text-zinc-400">Out of stock</span>
          <span className="font-semibold tabular-nums text-foreground">
            {fmtPct(outOfStockRate)}
          </span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-sm bg-amber-500" />
          <span className="text-zinc-600 dark:text-zinc-400">Low stock (&lt;10)</span>
          <span className="font-semibold tabular-nums text-foreground">
            {fmtPct(lowStockRate)}
          </span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-sm bg-emerald-600" />
          <span className="text-zinc-600 dark:text-zinc-400">Healthy</span>
          <span className="font-semibold tabular-nums text-foreground">
            {fmtPct(healthyRate)}
          </span>
        </li>
      </ul>
    </div>
  );
}

function DailyStackedChart({ rows }: { rows: StockExposureDailyTrendRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">No data for this range.</p>
    );
  }
  const max = Math.max(
    1,
    ...rows.map((r) => r.outOfStockViews + r.lowStockViews + r.healthyViews),
  );
  return (
    <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
      {rows.map((r) => {
        const sum = r.outOfStockViews + r.lowStockViews + r.healthyViews;
        const wO = sum > 0 ? (r.outOfStockViews / sum) * 100 : 0;
        const wL = sum > 0 ? (r.lowStockViews / sum) * 100 : 0;
        const wH = sum > 0 ? (r.healthyViews / sum) * 100 : 0;
        const barH = 4 + (sum / max) * 20;
        return (
          <div key={r.day} className="flex min-w-0 items-center gap-2 text-xs">
            <span className="w-24 shrink-0 font-mono text-zinc-500 dark:text-zinc-400">
              {r.day}
            </span>
            <div
              className="min-w-0 flex-1 overflow-hidden rounded-md bg-zinc-200/90 dark:bg-zinc-800/80"
              style={{ height: barH }}
              title={`${r.day}: OOS ${r.outOfStockViews}, low ${r.lowStockViews}, healthy ${r.healthyViews}`}
            >
              <div className="flex h-full w-full">
                {wO > 0 ? (
                  <div
                    className="h-full bg-rose-600"
                    style={{ width: `${wO}%` }}
                  />
                ) : null}
                {wL > 0 ? (
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${wL}%` }}
                  />
                ) : null}
                {wH > 0 ? (
                  <div
                    className="h-full bg-emerald-600"
                    style={{ width: `${wH}%` }}
                  />
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const SOURCE_ROW_GRID =
  "grid grid-cols-[minmax(0,1.35fr)_5.25rem_4.25rem_4.25rem_4.25rem_1.75rem] items-center gap-x-2 px-3 py-2.5 text-sm";

function SourceAccordionTable({ rows }: { rows: StockExposureBySourceRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">No attributed traffic.</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[36rem] overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950/40">
        <div
          className={`${SOURCE_ROW_GRID} border-b border-zinc-200 bg-zinc-50/90 text-xs font-semibold uppercase tracking-wide text-foreground dark:border-zinc-800 dark:bg-zinc-900/50`}
        >
          <span>Source</span>
          <span className="text-right">Views</span>
          <span className="text-right">OOS %</span>
          <span className="text-right">Low %</span>
          <span className="text-right">Healthy %</span>
          <span className="sr-only">Expand</span>
        </div>
        {rows.map((r) => (
          <details
            key={r.source}
            className="group border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/80"
          >
            <summary
              className={`${SOURCE_ROW_GRID} cursor-pointer list-none text-zinc-800 marker:content-none [&::-webkit-details-marker]:hidden dark:text-zinc-200`}
            >
              <span className="min-w-0 truncate font-medium text-foreground" title={r.source}>
                {r.source}
              </span>
              <span className="text-right tabular-nums">{fmtInt(r.totalViews)}</span>
              <span className="text-right tabular-nums text-rose-700 dark:text-rose-300">
                {fmtPct(r.outOfStockRate)}
              </span>
              <span className="text-right tabular-nums text-amber-800 dark:text-amber-200/90">
                {fmtPct(r.lowStockRate)}
              </span>
              <span className="text-right tabular-nums text-emerald-800 dark:text-emerald-300/90">
                {fmtPct(r.healthyRate)}
              </span>
              <span
                className="flex justify-end text-zinc-400 transition-transform duration-200 group-open:rotate-180 dark:text-zinc-500"
                aria-hidden
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </summary>
            <div className="border-t border-zinc-100 bg-zinc-50/60 px-3 py-3 dark:border-zinc-800/80 dark:bg-zinc-900/30">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Top product pages by views for this source (same date range).
              </p>
              {r.topProducts.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">No breakdown.</p>
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
                          {fmtInt(p.views)} views
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

export function StockExposureDashboard({ data }: { data: StockExposureAnalytics }) {
  const { totals, percentages } = data;
  const highOos = percentages.outOfStockRate > 15;
  const highLow = percentages.lowStockRate > 30;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
      <p className="text-sm">
        <Link
          href="/"
          className="font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Home
        </Link>
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Stock exposure
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Product page views from{" "}
            <code className="rounded bg-zinc-200/80 px-1 py-0.5 text-xs dark:bg-zinc-800">
              productStockLookups
            </code>{" "}
            — each row is one view (London dates). See paid traffic landing on OOS
            and low-stock SKUs.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {RANGE_OPTIONS.map((opt) => {
          const active = data.range === opt.value;
          const href =
            opt.value === "7d"
              ? "/admin/stock-exposure"
              : `/admin/stock-exposure?range=${encodeURIComponent(opt.value)}`;
          return (
            <Link
              key={opt.value}
              href={href}
              className={
                active
                  ? "rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background"
                  : "rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              }
            >
              {opt.label}
            </Link>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Time zone: {WAREHOUSE_TZ} · Filters apply to{" "}
        <code className="rounded bg-zinc-200/70 px-1 text-[0.7rem] dark:bg-zinc-800">
          createdAt
        </code>
      </p>

      {(highOos || highLow) && (
        <div className="mt-4 space-y-2">
          {highOos ? (
            <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-950 dark:border-rose-800/80 dark:bg-rose-950/35 dark:text-rose-100">
              High wasted traffic to out of stock products (
              {fmtPct(percentages.outOfStockRate)} of views).
            </div>
          ) : null}
          {highLow ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/35 dark:text-amber-100">
              High exposure on low-stock products (&lt;10 units):{" "}
              {fmtPct(percentages.lowStockRate)} of views.
            </div>
          ) : null}
        </div>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-foreground">Summary</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label="Total product views"
            value={fmtInt(totals.totalViews)}
            tone="zinc"
          />
          <KpiCard
            label="Out of stock views"
            value={fmtInt(totals.outOfStockViews)}
            tone="rose"
          />
          <KpiCard
            label="Low stock views"
            value={fmtInt(totals.lowStockViews)}
            tone="amber"
          />
          <KpiCard
            label="Healthy stock views"
            value={fmtInt(totals.healthyViews)}
            tone="emerald"
          />
          <KpiCard
            label="% traffic on OOS products"
            value={fmtPct(percentages.outOfStockRate)}
            sub="Of all product views in range"
            tone="rose"
          />
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
          <h2 className="text-base font-semibold text-foreground">
            Healthy vs low vs out of stock
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Share of page exposure volume (not unique products).
          </p>
          <div className="mt-4 flex justify-center">
            <ExposurePie data={data} />
          </div>
        </section>
        <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
          <h2 className="text-base font-semibold text-foreground">
            Daily exposure by stock bucket
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Stacked by day ({WAREHOUSE_TZ}).
          </p>
          <div className="mt-4">
            <DailyStackedChart rows={data.dailyTrend} />
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
        <h2 className="text-base font-semibold text-foreground">
          Traffic source attribution
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Sorted by highest OOS exposure first. Empty or missing UTM →{" "}
          <span className="font-medium text-foreground">non_landing_page</span>. Expand a
          row for the five storefront product pages with the most views for that source (
          <code className="rounded bg-zinc-200/70 px-1 text-[0.7rem] dark:bg-zinc-800">
            {`{handle}.myshopify.com`}
          </code>
          ).
        </p>
        <div className="mt-4">
          <SourceAccordionTable rows={data.bySource} />
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
          <h2 className="text-base font-semibold text-foreground">
            Top out-of-stock products
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            By view count; stock is total units at lookup time.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2 pr-2 font-semibold">Product</th>
                  <th className="py-2 pr-2 font-semibold">Views</th>
                  <th className="py-2 pr-2 font-semibold">Stock</th>
                  <th className="py-2 font-semibold">Sources</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {data.topOutOfStockProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-3 text-sm text-zinc-500 dark:text-zinc-400"
                    >
                      No out-of-stock views in this range.
                    </td>
                  </tr>
                ) : (
                  data.topOutOfStockProducts.map((p) => (
                    <tr key={p.handle} className="align-top text-zinc-800 dark:text-zinc-200">
                      <td className="max-w-[12rem] py-2 pr-2">
                        <div className="font-medium text-foreground">{p.title}</div>
                        <div className="mt-0.5 font-mono text-xs text-zinc-500">
                          {p.handle}
                        </div>
                      </td>
                      <td className="py-2 pr-2 tabular-nums">{fmtInt(p.views)}</td>
                      <td className="py-2 pr-2 tabular-nums text-rose-700 dark:text-rose-300">
                        {fmtInt(p.totalStock)}
                      </td>
                      <td className="py-2 text-xs text-zinc-600 dark:text-zinc-400">
                        {p.sourceBreakdown
                          .slice(0, 4)
                          .map((s) => `${s.source}: ${fmtInt(s.views)}`)
                          .join(" · ")}
                        {p.sourceBreakdown.length > 4
                          ? ` · +${p.sourceBreakdown.length - 4} more`
                          : ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
          <h2 className="text-base font-semibold text-foreground">
            Top low-stock products
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            1–9 units at lookup; ranked by views.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[24rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2 pr-2 font-semibold">Product</th>
                  <th className="py-2 pr-2 font-semibold">Views</th>
                  <th className="py-2 font-semibold">Total stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {data.topLowStockProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-3 text-sm text-zinc-500 dark:text-zinc-400"
                    >
                      No low-stock-only views in this range.
                    </td>
                  </tr>
                ) : (
                  data.topLowStockProducts.map((p) => (
                    <tr key={p.handle} className="text-zinc-800 dark:text-zinc-200">
                      <td className="max-w-[14rem] py-2 pr-2">
                        <div className="font-medium text-foreground">{p.title}</div>
                        <div className="mt-0.5 font-mono text-xs text-zinc-500">
                          {p.handle}
                        </div>
                      </td>
                      <td className="py-2 pr-2 tabular-nums">{fmtInt(p.views)}</td>
                      <td className="py-2 tabular-nums text-amber-800 dark:text-amber-200/90">
                        {p.totalStock % 1 === 0
                          ? fmtInt(p.totalStock)
                          : p.totalStock.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
