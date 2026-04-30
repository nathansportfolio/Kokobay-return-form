import type { Metadata } from "next";
import Link from "next/link";
import {
  listReturnLogsPaged,
  type ReturnLogListItem,
  type ReturnLogListOrder,
  type ReturnLogListSort,
} from "@/lib/returnLog";
import { formatGbp } from "@/lib/kokobayOrderLines";
import { returnLogDateBounds } from "@/lib/returnLogDateRange";
import {
  RETURN_LOG_PAGE_SIZES,
  parseReturnLogListQuery,
  returnLogListHref,
  returnLogListPageHref,
  returnLogListSortHeaderHref,
  sortHeaderArrow,
  type ReturnLogListState,
} from "@/lib/returnLogListParams";
import {
  resolveShopifyOrderDisplaysForOrderRefs,
  shopifyFinancialStatusIsFullyRefunded,
  shopifyFinancialStatusLabel,
} from "@/lib/shopifyReturnOrderLookup";
import {
  shopifyOrderAdminUrlByOrderId,
  shopifyOrderAdminUrlFromOrderRef,
} from "@/lib/shopifyOrderAdminUrl";
import { WAREHOUSE_TZ, formatDateAsOrdinalInTimeZone } from "@/lib/warehouseLondonDay";

export const dynamic = "force-dynamic";

type MetadataProps = {
  searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
};

export async function generateMetadata({
  searchParams,
}: MetadataProps): Promise<Metadata> {
  const sp = await searchParams;
  const q = parseReturnLogListQuery(sp);
  if (q.refundPending) {
    return {
      title: "Awaiting refund · Logged returns",
      description:
        "Returns logged in the warehouse where a full refund has not been marked yet.",
    };
  }
  return {
    title: "Logged returns",
    description:
      "Returns registered in the warehouse with email and refund status.",
  };
}

function shopifyReturnLogRowAdminHref(
  r: ReturnLogListItem,
  resolvedIdByOrderRef: Map<string, string>,
): string {
  const id =
    r.shopifyOrderId ?? resolvedIdByOrderRef.get(r.orderRef.trim());
  return id
    ? shopifyOrderAdminUrlByOrderId(id)
    : shopifyOrderAdminUrlFromOrderRef(r.orderRef);
}

function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDateAsOrdinalInTimeZone(d, WAREHOUSE_TZ);
}

type PageProps = {
  searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
};

export default async function LoggedReturnsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = parseReturnLogListQuery(sp);

  let err: string | null = null;
  let data: Awaited<ReturnType<typeof listReturnLogsPaged>> | null = null;
  try {
    const createdAtRange = returnLogDateBounds(q.date);
    data = await listReturnLogsPaged({
      page: q.page,
      pageSize: q.pageSize,
      sort: q.sort,
      order: q.order,
      createdAtRange,
      refundPendingOnly: q.refundPending,
    });
  } catch {
    err = "Could not load return log. Is MongoDB configured?";
  }

  if (err) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold">Logged returns</h1>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{err}</p>
        <Link
          className="mt-4 inline-block text-sm font-medium text-foreground underline"
          href="/returns"
        >
          Back to returns
        </Link>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { items: rows, total, page, pageSize } = data;

  const refsToFetchForShopify = new Set<string>();
  for (const r of rows) {
    const ref = r.orderRef.trim();
    if (!r.shopifyOrderId) refsToFetchForShopify.add(ref);
    if (q.refundPending) refsToFetchForShopify.add(ref);
  }

  const shopifyDisplayByOrderRef =
    refsToFetchForShopify.size > 0 && process.env.SHOPIFY_STORE?.trim()
      ? await resolveShopifyOrderDisplaysForOrderRefs([
          ...refsToFetchForShopify,
        ])
      : new Map();

  const shopifyAdminIdByOrderRef = new Map<string, string>();
  for (const ref of refsToFetchForShopify) {
    const d = shopifyDisplayByOrderRef.get(ref);
    if (d?.shopifyOrderId) shopifyAdminIdByOrderRef.set(ref, d.shopifyOrderId);
  }

  const filteredRows =
    q.refundPending &&
    refsToFetchForShopify.size > 0 &&
    Boolean(process.env.SHOPIFY_STORE?.trim())
      ? rows.filter((r) => {
          const d = shopifyDisplayByOrderRef.get(r.orderRef.trim());
          if (!d) return true;
          return !shopifyFinancialStatusIsFullyRefunded(d.financialStatus);
        })
      : rows;

  const hiddenByShopifyFullyRefunded =
    q.refundPending && rows.length > 0
      ? rows.length - filteredRows.length
      : 0;

  const current: ReturnLogListState = {
    page,
    pageSize,
    sort: q.sort,
    order: q.order,
    date: q.date,
    refundPending: q.refundPending,
  };
  const fromInput =
    q.date.kind === "custom" ? q.date.fromYmd : "";
  const toInput =
    q.date.kind === "custom" ? q.date.toYmd : "";
  const isPreset = (v: "today" | "yesterday" | "7d") =>
    q.date.kind === "preset" && q.date.value === v;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const lastPage = Math.max(1, Math.ceil(total / pageSize) || 1);

  const colHeader = (column: ReturnLogListSort, label: string) => {
    return (
      <th className="px-3 py-2.5 sm:px-4">
        <Link
          href={returnLogListSortHeaderHref(current, column)}
          className="inline-flex items-center font-semibold text-foreground underline decoration-zinc-300 underline-offset-2 transition-colors hover:decoration-foreground"
        >
          {label}
          <span className="text-zinc-400" aria-hidden>
            {sortHeaderArrow(q.sort, q.order, column)}
          </span>
        </Link>
      </th>
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">
          {q.refundPending ? "Returns awaiting refund" : "Logged returns"}
        </h1>
        <Link
          href="/returns"
          className="inline-flex shrink-0 items-center justify-center rounded-md bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background shadow-sm transition-colors hover:bg-foreground/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          New return
        </Link>
      </div>
      {q.refundPending ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          <strong className="font-medium">Refund</strong> column is this app’s flag
          (not yet marked). When Shopify is configured, we also load each order’s live{" "}
          <strong className="font-medium">payment status</strong> and{" "}
          <strong className="font-medium">hide</strong> rows Shopify already shows as{" "}
          <strong className="font-medium">Refunded</strong> so the list matches money
          movement. <strong className="font-medium">Refund in Shopify</strong> opens
          Admin refund with stored id or the same live lookup as the return screen.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Link
          href={returnLogListHref(current, {
            page: 1,
            refundPending: true,
          })}
          className={
            q.refundPending
              ? "rounded-md bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background shadow-sm"
              : "rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          }
        >
          View returns yet to be refunded
        </Link>
        <Link
          href={returnLogListHref(current, {
            page: 1,
            refundPending: false,
          })}
          className={
            !q.refundPending
              ? "rounded-md bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background shadow-sm"
              : "rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          }
        >
          View all returns
        </Link>
      </div>

      <div
        className="mt-4 space-y-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
        role="search"
        aria-label="Date range filter for Logged Returns"
      >
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Logged time uses the warehouse day in {WAREHOUSE_TZ}. Quick ranges:
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { label: "Today", value: "today" as const },
              { label: "Yesterday", value: "yesterday" as const },
              { label: "Past 7 days", value: "7d" as const },
            ] as const
          ).map(({ label, value }) => (
            <Link
              key={value}
              href={returnLogListHref(
                { ...current, page: 1, date: { kind: "preset", value } },
                { page: 1, date: { kind: "preset", value } },
              )}
              className={
                isPreset(value)
                  ? "rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background"
                  : "rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              }
            >
              {label}
            </Link>
          ))}
          <Link
            href={returnLogListHref(
              { ...current, page: 1, date: { kind: "all" } },
              { page: 1, date: { kind: "all" } },
            )}
            className={
              q.date.kind === "all"
                ? "rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background"
                : "rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            }
          >
            All time
          </Link>
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3"
          method="get"
          action="/returns/logged"
        >
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={String(q.pageSize)} />
          <input type="hidden" name="sort" value={q.sort} />
          <input type="hidden" name="order" value={q.order} />
          {q.refundPending ? (
            <input type="hidden" name="refundPending" value="1" />
          ) : null}
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-0.5 text-sm">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">From</span>
              <input
                className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-foreground dark:border-zinc-700 dark:bg-zinc-900"
                type="date"
                name="from"
                defaultValue={fromInput}
                required
              />
            </label>
            <label className="flex flex-col gap-0.5 text-sm">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">To</span>
              <input
                className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-foreground dark:border-zinc-700 dark:bg-zinc-900"
                type="date"
                name="to"
                defaultValue={toInput}
                required
              />
            </label>
            <button
              type="submit"
              className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/80 dark:hover:bg-zinc-800"
            >
              Apply range
            </button>
          </div>
        </form>
        {q.date.kind === "custom" ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Custom: {q.date.fromYmd} to {q.date.toYmd} (inclusive, London)
          </p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">
          {q.date.kind === "all" && !q.refundPending ? (
            <>
              No returns logged yet. Log one from the{" "}
              <Link className="font-medium underline" href="/returns">
                return flow
              </Link>
              .
            </>
          ) : null}
          {q.date.kind === "all" && q.refundPending ? (
            <>
              No returns awaiting a refund.{" "}
              <Link
                className="font-medium text-foreground underline"
                href={returnLogListHref(
                  {
                    page: 1,
                    pageSize,
                    sort: q.sort,
                    order: q.order,
                    date: { kind: "all" },
                    refundPending: false,
                  },
                )}
              >
                View all returns
              </Link>
            </>
          ) : null}
          {q.date.kind !== "all" ? (
            <>
              No returns in this date range. Try another range or view{" "}
              <Link
                className="font-medium text-foreground underline"
                href={returnLogListHref({
                  page: 1,
                  pageSize,
                  sort: q.sort,
                  order: q.order,
                  date: { kind: "all" },
                  refundPending: q.refundPending,
                })}
              >
                all time
              </Link>
              .
            </>
          ) : null}
        </p>
      ) : filteredRows.length === 0 && q.refundPending ? (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
          Every return on this page already has live Shopify payment status{" "}
          <strong className="font-medium">Refunded</strong>, so nothing is shown
          here.
          {page > 1 ? (
            <>
              {" "}
              <Link
                className="font-medium text-foreground underline"
                href={returnLogListPageHref(current, page - 1)}
              >
                Previous page
              </Link>
              {" · "}
            </>
          ) : null}
          <Link
            className="font-medium text-foreground underline"
            href={returnLogListHref({
              page: 1,
              pageSize,
              sort: q.sort,
              order: q.order,
              date: q.date,
              refundPending: false,
            })}
          >
            View all returns
          </Link>
          . Mark <strong className="font-medium">Refund</strong> in this app when
          processing is done so your list stays accurate.
        </p>
      ) : (
        <>
          {hiddenByShopifyFullyRefunded > 0 ? (
            <p
              className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
              role="status"
            >
              Hiding {hiddenByShopifyFullyRefunded} return
              {hiddenByShopifyFullyRefunded === 1 ? "" : "s"} on this page — Shopify
              already shows payment as <strong className="font-medium">Refunded</strong>.
              Mark <strong className="font-medium">Refund</strong> in the app when you
              finish so those rows leave the database filter too.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-500">
            <span>Rows per page</span>
            <div className="flex flex-wrap items-center gap-1">
              {RETURN_LOG_PAGE_SIZES.map((n) => (
                <Link
                  key={n}
                  href={returnLogListHref(
                    { ...current, page: 1, pageSize: current.pageSize },
                    { page: 1, pageSize: n },
                  )}
                  className={
                    n === pageSize
                      ? "rounded-md bg-foreground px-2 py-0.5 font-medium text-background"
                      : "rounded-md px-2 py-0.5 font-medium text-foreground underline decoration-zinc-300 underline-offset-2 hover:decoration-foreground"
                  }
                >
                  {n}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/50">
                  {colHeader("date", "Logged")}
                  <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">
                    Order
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">
                    Lines
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">
                    Value
                  </th>
                  {colHeader("email", "Email")}
                  {colHeader("refund", "Refund")}
                  {q.refundPending ? (
                    <th
                      className="px-3 py-2.5 font-semibold text-foreground sm:px-4"
                      title="Live Shopify REST financial_status for this order"
                    >
                      Shopify payment
                    </th>
                  ) : null}
                  <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {filteredRows.map((r) => (
                  <tr
                    key={r.returnUid}
                    className="text-zinc-800 dark:text-zinc-200"
                  >
                    <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                      {fmtWhen(r.createdAt)}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs sm:px-4 sm:text-sm">
                      {r.orderRef}
                    </td>
                    <td className="px-3 py-3 sm:px-4">{r.lineCount}</td>
                    <td className="px-3 py-3 sm:px-4">
                      {formatGbp(r.totalRefundGbp)}
                    </td>
                    <td
                      className={`px-3 py-3 font-medium sm:px-4 ${
                        r.customerEmailSent
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-zinc-500"
                      }`}
                    >
                      {r.customerEmailSent ? "Yes" : "No"}
                    </td>
                    <td
                      className={`px-3 py-3 font-medium sm:px-4 ${
                        r.fullRefundIssued
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {r.fullRefundIssued ? "Yes" : "No"}
                    </td>
                    {q.refundPending ? (
                      <td className="px-3 py-3 text-sm capitalize sm:px-4">
                        {shopifyFinancialStatusLabel(
                          shopifyDisplayByOrderRef.get(
                            r.orderRef.trim(),
                          )?.financialStatus,
                        )}
                      </td>
                    ) : null}
                    <td className="px-3 py-3 sm:px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={`/returns/${encodeURIComponent(r.orderRef)}`}
                          className="inline-flex min-h-8 min-w-[3.25rem] items-center justify-center rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                          title="Open return in app"
                        >
                          View
                        </Link>
                        <a
                          href={shopifyReturnLogRowAdminHref(
                            r,
                            shopifyAdminIdByOrderRef,
                          )}
                          className="inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-[#006e52] bg-[#008060] px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#006e52] focus:outline-none focus:ring-2 focus:ring-[#008060] focus:ring-offset-1 dark:focus:ring-offset-zinc-950"
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Refund order in Shopify admin (new tab)"
                        >
                          Refund in Shopify
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col items-stretch justify-between gap-3 border-t border-zinc-200 pt-4 text-sm sm:flex-row sm:items-center dark:border-zinc-800">
            <p className="text-zinc-600 dark:text-zinc-400" aria-live="polite">
              {q.refundPending ? (
                <>
                  Showing {filteredRows.length} of {rows.length} on this page
                  {hiddenByShopifyFullyRefunded > 0
                    ? ` (${hiddenByShopifyFullyRefunded} hidden: Shopify already refunded)`
                    : ""}
                  . Database filter: {from}–{to} of {total} with refund not marked in
                  app.
                </>
              ) : (
                <>
                  {from}–{to} of {total} return{total === 1 ? "" : "s"}
                </>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={returnLogListPageHref(current, Math.max(1, page - 1))}
                className={
                  page <= 1
                    ? "pointer-events-none cursor-not-allowed rounded-lg border border-zinc-200 px-3 py-1.5 text-zinc-400 dark:border-zinc-800"
                    : "rounded-lg border border-zinc-200 px-3 py-1.5 font-medium text-foreground hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                }
                aria-disabled={page <= 1}
                tabIndex={page <= 1 ? -1 : 0}
              >
                Previous
              </Link>
              <span className="px-1 text-zinc-500" aria-label="Page numbers">
                Page {page} of {lastPage}
              </span>
              <Link
                href={returnLogListPageHref(
                  current,
                  Math.min(lastPage, page + 1),
                )}
                className={
                  page >= lastPage
                    ? "pointer-events-none cursor-not-allowed rounded-lg border border-zinc-200 px-3 py-1.5 text-zinc-400 dark:border-zinc-800"
                    : "rounded-lg border border-zinc-200 px-3 py-1.5 font-medium text-foreground hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                }
                aria-disabled={page >= lastPage}
                tabIndex={page >= lastPage ? -1 : 0}
              >
                Next
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
