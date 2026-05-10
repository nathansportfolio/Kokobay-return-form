"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface BucketReport {
  add_to_cart_count: number;
  checkout_started_count: number;
  checkout_completed_count: number;
  abandonment_rate: number;
}

interface ReportPayload {
  date_range: { from: string | null; to: string | null };
  total_events: number;
  low_stock: BucketReport;
  last_one: BucketReport;
  normal: BucketReport;
  overall: BucketReport;
}

interface ReportResponse {
  ok?: boolean;
  report?: ReportPayload;
  error?: string;
}

interface ReportState {
  loading: boolean;
  error: string | null;
  data: ReportPayload | null;
}

const NUM_FORMAT = new Intl.NumberFormat("en-GB");

function formatCount(n: number): string {
  return NUM_FORMAT.format(Math.max(0, Math.round(n)));
}

function formatRate(n: number): string {
  if (!Number.isFinite(n)) return "—";
  // One decimal is plenty for an abandonment %.
  return `${(Math.round(n * 10) / 10).toFixed(1)}%`;
}

function conversionRate(b: BucketReport): number {
  if (b.add_to_cart_count <= 0) return 0;
  return (b.checkout_completed_count / b.add_to_cart_count) * 100;
}

function startedFromAddRate(b: BucketReport): number {
  if (b.add_to_cart_count <= 0) return 0;
  return (b.checkout_started_count / b.add_to_cart_count) * 100;
}

function localInputDate(d: Date): string {
  // `<input type="date">` expects YYYY-MM-DD in the user’s local timezone.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { from: localInputDate(from), to: localInputDate(to) };
}

function isoFromLocalDate(date: string, end: boolean): string | null {
  if (!date) return null;
  // Local-midnight start; local-end-of-day for the `to` side.
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = end
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

export function CartIntelligenceClient() {
  const [{ from, to }, setRange] = useState(defaultDateRange);
  const [appliedRange, setAppliedRange] = useState(() => defaultDateRange());
  const [refreshTick, setRefreshTick] = useState(0);
  const [reportState, setReportState] = useState<ReportState>({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    const ac = new AbortController();
    const fromIso = isoFromLocalDate(appliedRange.from, false);
    const toIso = isoFromLocalDate(appliedRange.to, true);
    const params = new URLSearchParams();
    if (fromIso) params.set("from", fromIso);
    if (toIso) params.set("to", toIso);
    void (async () => {
      try {
        const res = await fetch(
          `/api/cart-intelligence/report?${params.toString()}`,
          { cache: "no-store", signal: ac.signal },
        );
        const data = (await res.json()) as ReportResponse;
        if (ac.signal.aborted) return;
        if (!res.ok || !data.report) {
          setReportState({
            loading: false,
            error: data.error ?? `Load failed (HTTP ${res.status})`,
            data: null,
          });
          return;
        }
        setReportState({ loading: false, error: null, data: data.report });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setReportState({
          loading: false,
          error: e instanceof Error ? e.message : "Load failed",
          data: null,
        });
      }
    })();
    return () => {
      ac.abort();
    };
  }, [appliedRange.from, appliedRange.to, refreshTick]);

  const apply = useCallback(() => {
    setReportState((prev) => ({ ...prev, loading: true, error: null }));
    setAppliedRange({ from, to });
  }, [from, to]);

  const reset = useCallback(() => {
    const next = defaultDateRange();
    setRange(next);
    setReportState((prev) => ({ ...prev, loading: true, error: null }));
    setAppliedRange(next);
  }, []);

  const reload = useCallback(() => {
    setReportState((prev) => ({ ...prev, loading: true, error: null }));
    setRefreshTick((t) => t + 1);
  }, []);

  const data = reportState.data;

  const buckets = useMemo(() => {
    if (!data) return null;
    return [
      {
        key: "last_one" as const,
        label: "Last-one carts",
        description:
          "Carts that contained at least one variant with inventory_remaining === 1.",
        accent:
          "border-rose-300 bg-rose-50/80 dark:border-rose-800/60 dark:bg-rose-950/30",
        rateAccent: "text-rose-700 dark:text-rose-300",
        report: data.last_one,
      },
      {
        key: "low_stock" as const,
        label: "Low-stock carts",
        description:
          "inventory_remaining > 1 and < 7 on at least one item in the cart.",
        accent:
          "border-amber-300 bg-amber-50/80 dark:border-amber-800/60 dark:bg-amber-950/30",
        rateAccent: "text-amber-700 dark:text-amber-300",
        report: data.low_stock,
      },
      {
        key: "normal" as const,
        label: "Normal carts",
        description: "Items with healthy stock (inventory_remaining ≥ 7).",
        accent:
          "border-sky-300 bg-sky-50/80 dark:border-sky-800/60 dark:bg-sky-950/30",
        rateAccent: "text-sky-700 dark:text-sky-300",
        report: data.normal,
      },
    ];
  }, [data]);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Cart Intelligence
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Abandonment rates per stock-level cohort, sourced from the Shopify
          Custom Pixel. A session counts at most once per cohort per event,
          so the abandonment ratio reflects shoppers — not items.
        </p>
      </header>

      <section
        aria-labelledby="cart-intel-filters"
        className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950/60"
      >
        <h2
          id="cart-intel-filters"
          className="mb-3 text-sm font-semibold text-foreground"
        >
          Date range
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs text-zinc-600 dark:text-zinc-400">
            From
            <input
              type="date"
              value={from}
              onChange={(e) =>
                setRange((prev) => ({ ...prev, from: e.target.value }))
              }
              className="mt-0.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm shadow-sm dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col text-xs text-zinc-600 dark:text-zinc-400">
            To
            <input
              type="date"
              value={to}
              onChange={(e) =>
                setRange((prev) => ({ ...prev, to: e.target.value }))
              }
              className="mt-0.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm shadow-sm dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={apply}
              className="rounded-md border border-sky-500/60 bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 dark:border-sky-400/40 dark:bg-sky-500 dark:hover:bg-sky-400"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
            >
              Last 30 days
            </button>
            <button
              type="button"
              onClick={reload}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
            >
              Reload
            </button>
          </div>
        </div>
        {data ? (
          <p className="mt-3 text-xs tabular-nums text-zinc-500">
            Showing {formatCount(data.total_events)} pixel event
            {data.total_events === 1 ? "" : "s"}{" "}
            {data.date_range.from
              ? `from ${new Date(data.date_range.from).toLocaleString()}`
              : "across all time"}
            {data.date_range.to
              ? ` to ${new Date(data.date_range.to).toLocaleString()}`
              : ""}
            .
          </p>
        ) : null}
      </section>

      {reportState.error ? (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
        >
          {reportState.error}
        </div>
      ) : null}

      {reportState.loading && !data ? (
        <p className="rounded-lg border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-700">
          Loading cart cohorts…
        </p>
      ) : null}

      {data && buckets ? (
        <>
          <section
            aria-labelledby="cart-intel-cards"
            className="mb-6 grid gap-3 sm:grid-cols-3"
          >
            <h2 id="cart-intel-cards" className="sr-only">
              Cohort summary
            </h2>
            {buckets.map((b) => (
              <article
                key={b.key}
                className={`relative flex h-full flex-col rounded-xl border p-4 shadow-sm ${b.accent}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {b.label}
                  </h3>
                  <span className="text-[0.65rem] font-medium uppercase tracking-wide text-zinc-500">
                    Abandon
                  </span>
                </div>
                <p
                  className={`mt-1 text-3xl font-bold tabular-nums tracking-tight ${b.rateAccent}`}
                >
                  {formatRate(b.report.abandonment_rate)}
                </p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {b.description}
                </p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-zinc-500">Add</dt>
                    <dd className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCount(b.report.add_to_cart_count)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Started</dt>
                    <dd className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCount(b.report.checkout_started_count)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Completed</dt>
                    <dd className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCount(b.report.checkout_completed_count)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </section>

          <section aria-labelledby="cart-intel-table">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2
                id="cart-intel-table"
                className="text-sm font-semibold text-foreground"
              >
                Cohort breakdown
              </h2>
              <span className="text-xs text-zinc-500">
                Sessions, not items.
              </span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
              <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
                <thead className="bg-zinc-50/90 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/50">
                  <tr>
                    <th className="px-3 py-2 font-semibold" scope="col">
                      Cohort
                    </th>
                    <th
                      className="px-3 py-2 text-right font-semibold"
                      scope="col"
                    >
                      Add to cart
                    </th>
                    <th
                      className="px-3 py-2 text-right font-semibold"
                      scope="col"
                    >
                      Checkout started
                    </th>
                    <th
                      className="px-3 py-2 text-right font-semibold"
                      scope="col"
                    >
                      Checkout completed
                    </th>
                    <th
                      className="px-3 py-2 text-right font-semibold"
                      scope="col"
                    >
                      Started / Add
                    </th>
                    <th
                      className="px-3 py-2 text-right font-semibold"
                      scope="col"
                    >
                      Conversion
                    </th>
                    <th
                      className="px-3 py-2 text-right font-semibold"
                      scope="col"
                    >
                      Abandonment
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {buckets.map((b) => (
                    <tr
                      key={b.key}
                      className="text-zinc-800 dark:text-zinc-200"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{b.label}</div>
                        <div className="text-xs text-zinc-500">
                          {b.description}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCount(b.report.add_to_cart_count)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCount(b.report.checkout_started_count)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCount(b.report.checkout_completed_count)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatRate(startedFromAddRate(b.report))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">
                        {formatRate(conversionRate(b.report))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-rose-700 dark:text-rose-300">
                        {formatRate(b.report.abandonment_rate)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-zinc-50 text-zinc-900 dark:bg-zinc-900/40 dark:text-zinc-100">
                    <td className="px-3 py-2 font-semibold">Overall</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {formatCount(data.overall.add_to_cart_count)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {formatCount(data.overall.checkout_started_count)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {formatCount(data.overall.checkout_completed_count)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatRate(startedFromAddRate(data.overall))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">
                      {formatRate(conversionRate(data.overall))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-rose-700 dark:text-rose-300">
                      {formatRate(data.overall.abandonment_rate)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {reportState.loading ? (
            <p className="mt-3 text-xs text-zinc-500">Refreshing…</p>
          ) : null}
        </>
      ) : null}

      <details className="mt-8 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700">
        <summary className="cursor-pointer font-medium text-foreground">
          How is this calculated?
        </summary>
        <div className="mt-2 space-y-2 text-zinc-600 dark:text-zinc-400">
          <p>
            We bucket each event by stock level using:
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>last_one</strong>: <code>inventory_remaining === 1</code>
            </li>
            <li>
              <strong>low_stock</strong>:{" "}
              <code>inventory_remaining &gt; 1 &amp;&amp; inventory_remaining &lt; 7</code>
            </li>
            <li>
              <strong>normal</strong>: everything else
            </li>
          </ul>
          <p>
            For each cohort we count distinct sessions per event type (add to
            cart, checkout started, checkout completed) and apply{" "}
            <code>
              (add - completed) / add × 100
            </code>{" "}
            for the abandonment rate.
          </p>
        </div>
      </details>
    </div>
  );
}
