import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
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
  type ShopifyOrderDisplay,
  resolveShopifyOrderDisplaysForOrderRefs,
  returnLogCoversEntireShopifyOrder,
  shopifyOrderDisplayIndicatesMoneyReturned,
  shopifyPaymentStatusLabelForReturnsList,
} from "@/lib/shopifyReturnOrderLookup";
import {
  returnLineDispositionHandlingPillClass,
  returnLineDispositionListBorderClass,
} from "@/lib/returnLineDispositionUi";
import { warehouseReturnAuditListCell } from "@/lib/returnAuditUi";
import { returnLineHandlingListingLabel } from "@/lib/returnLogTypes";
import {
  shopifyOrderAdminUrlByOrderId,
  shopifyOrderAdminUrlFromOrderRef,
} from "@/lib/shopifyOrderAdminUrl";
import { WAREHOUSE_TZ, formatDateAsOrdinalInTimeZone } from "@/lib/warehouseLondonDay";
import { RefundedTodaySoFar } from "@/components/RefundedTodaySoFar";
import { ReturnLogRefreshButton } from "@/components/ReturnLogRefreshButton";
import { ShopifyRefundAuditButton } from "@/components/ShopifyRefundAuditButton";

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

function shopifyReturnLogRowAdminOrderId(
  r: ReturnLogListItem,
  resolvedIdByOrderRef: Map<string, string>,
): string | null {
  const id =
    r.shopifyOrderId?.trim() ||
    resolvedIdByOrderRef.get(r.orderRef.trim())?.trim();
  return id || null;
}

function shopifyAuditCustomersForReturnRow(
  r: ReturnLogListItem,
  shopifyDisplayByOrderRef: Map<string, ShopifyOrderDisplay | null>,
): { customerName: string | null; customerEmail: string | null } {
  const s = shopifyDisplayByOrderRef.get(r.orderRef.trim());
  if (!s) return { customerName: null, customerEmail: null };
  const email = s.email?.trim() || null;
  const nameRaw = s.customerName?.trim();
  const customerName =
    nameRaw && nameRaw !== "—" ? nameRaw : null;
  return { customerName, customerEmail: email };
}

function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDateAsOrdinalInTimeZone(d, WAREHOUSE_TZ);
}

function loggedReturnIsFullShopifyOrder(
  r: ReturnLogListItem,
  shopifyDisplayByOrderRef: Map<string, ShopifyOrderDisplay | null>,
): boolean {
  const d = shopifyDisplayByOrderRef.get(r.orderRef.trim()) ?? null;
  return returnLogCoversEntireShopifyOrder(r.lines, d?.orderLineItems);
}

/**
 * Split stored line title (often `Product – Variant` from Shopify) into product vs
 * size/colour for the mobile refund list. Variant `a / b` → size `a`, colour `b`.
 */
function parseReturnLogLineTitleForMobile(title: string): {
  product: string;
  size: string;
  colour: string;
} {
  const raw = String(title ?? "").trim();
  if (!raw) {
    return { product: "—", size: "—", colour: "—" };
  }
  let product = raw;
  let variant = "";
  const byEn = raw.split(/\s*–\s*/);
  if (byEn.length >= 2) {
    product = byEn[0].trim() || "—";
    variant = byEn.slice(1).join(" – ").trim();
  } else {
    const byHy = raw.split(/\s+-\s+/);
    if (byHy.length >= 2) {
      product = byHy[0].trim() || "—";
      variant = byHy.slice(1).join(" - ").trim();
    }
  }
  if (!variant) {
    return { product: product || "—", size: "—", colour: "—" };
  }
  const parts = variant
    .split(/\s*\/\s/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return {
      product: product || "—",
      size: parts[0] ?? "—",
      colour: parts.slice(1).join(" / ") || "—",
    };
  }
  return { product: product || "—", size: variant, colour: "—" };
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
      <div className="mx-auto min-w-0 max-w-5xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
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

  /** Order refs to resolve in Shopify (batch). Set dedupes HTTP only, not rows. */
  const refsToFetchForShopify = new Set<string>();
  const shopifyConfigured = Boolean(process.env.SHOPIFY_STORE?.trim());
  for (const r of rows) {
    const ref = r.orderRef.trim();
    if (!ref) continue;
    if (shopifyConfigured) {
      refsToFetchForShopify.add(ref);
    } else if (!r.shopifyOrderId) {
      refsToFetchForShopify.add(ref);
    }
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

  const shopifyLiveRefundsEnabled =
    q.refundPending && Boolean(process.env.SHOPIFY_STORE?.trim());

  /** Presentational only: keyed by `returnUid`, never by `orderRef` (avoids collapsing rows). */
  const shopifyRefundedByReturnUid = new Map<string, boolean>();
  for (const r of rows) {
    if (!shopifyLiveRefundsEnabled) {
      shopifyRefundedByReturnUid.set(r.returnUid, false);
      continue;
    }
    const d = shopifyDisplayByOrderRef.get(r.orderRef.trim()) ?? null;
    shopifyRefundedByReturnUid.set(
      r.returnUid,
      shopifyOrderDisplayIndicatesMoneyReturned(d),
    );
  }

  const displayRows = shopifyLiveRefundsEnabled
    ? [
        ...rows.filter((r) => !shopifyRefundedByReturnUid.get(r.returnUid)),
        ...rows.filter((r) => shopifyRefundedByReturnUid.get(r.returnUid)),
      ]
    : rows;

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

  const greyedRowActionsTitle =
    "Disabled: Shopify already shows refund activity on this order";

  const refundPendingDesktopThead = (
    <thead>
      <tr className="border-b border-zinc-200 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/50">
        {colHeader("date", "Logged")}
        <th
          className="min-w-[6rem] max-w-[8rem] whitespace-nowrap px-2 py-2.5 text-center font-semibold text-foreground sm:px-3"
          title="Who logged this return (PIN signature), or 1 = team / 2 = admin on older rows"
        >
          By
        </th>
        <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">Order</th>
        <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">Lines</th>
        <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">Value</th>
        {colHeader("email", "Email")}
        <th
          className="px-3 py-2.5 font-semibold text-foreground sm:px-4"
          title="Staff marked refunded on this return (returnLogs.refunded)"
        >
          <Link
            href={returnLogListSortHeaderHref(current, "refund")}
            className="inline-flex items-center font-semibold text-foreground underline decoration-zinc-300 underline-offset-2 transition-colors hover:decoration-foreground"
          >
            Refund
            <span className="text-zinc-400" aria-hidden>
              {sortHeaderArrow(q.sort, q.order, "refund")}
            </span>
          </Link>
        </th>
        <th
          className="px-3 py-2.5 font-semibold text-foreground sm:px-4"
          title="Shopify financial_status plus refund records when status is still “paid”"
        >
          Shopify payment
        </th>
        <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">Action</th>
      </tr>
    </thead>
  );

  const renderDesktopTableRows = (rowList: ReturnLogListItem[]) =>
    rowList.map((r) => {
      const greyed = shopifyRefundedByReturnUid.get(r.returnUid) === true;
      const actionsDisabled = greyed;
      const lines = r.lines ?? [];
      return (
        <Fragment key={r.returnUid}>
          <tr
            className={
              greyed
                ? "bg-zinc-100/95 text-zinc-500 dark:bg-zinc-900/55 dark:text-zinc-400"
                : "text-zinc-800 dark:text-zinc-200"
            }
          >
            <td className="whitespace-nowrap px-3 py-3 sm:px-4">
              {fmtWhen(r.createdAt)}
            </td>
            <td
              className="max-w-[8rem] whitespace-nowrap px-2 py-3 text-center text-xs font-medium text-foreground sm:px-3 sm:text-sm"
              title="Who logged this return (PIN signature), or legacy 1/2"
            >
              {warehouseReturnAuditListCell(r.loggedByOperator, r.loggedByRole)}
            </td>
            <td className="px-3 py-3 font-mono text-xs sm:px-4 sm:text-sm">
              {r.orderRef}
            </td>
            <td className="px-3 py-3 sm:px-4">{r.lineCount}</td>
            <td className="px-3 py-3 sm:px-4">{formatGbp(r.totalRefundGbp)}</td>
            <td
              className={`px-3 py-3 font-medium sm:px-4 ${
                greyed
                  ? "text-zinc-500 dark:text-zinc-400"
                  : r.customerEmailSent
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-zinc-500"
              }`}
            >
              {r.customerEmailSent ? "Yes" : "No"}
            </td>
            <td
              className={`px-3 py-3 font-medium sm:px-4 ${
                r.refunded
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {r.refunded ? "Yes" : "No"}
            </td>
            <td className="px-3 py-3 text-sm normal-case sm:px-4">
              {shopifyPaymentStatusLabelForReturnsList(
                shopifyDisplayByOrderRef.get(r.orderRef.trim()) ?? null,
              )}
            </td>
            <td className="px-2 py-3 sm:px-4">
              <div className="flex max-w-[10.5rem] flex-col gap-2 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:gap-1.5 lg:max-w-none">
                {actionsDisabled ? (
                  <span
                    className="inline-flex min-h-9 w-full shrink-0 cursor-not-allowed items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 px-2 py-1.5 text-center text-xs font-semibold text-zinc-400 opacity-90 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-500 sm:w-auto sm:min-h-8 sm:min-w-[3.25rem] sm:px-2.5 sm:py-1"
                    title={greyedRowActionsTitle}
                    aria-disabled="true"
                  >
                    View
                  </span>
                ) : (
                  <Link
                    href={`/returns/${encodeURIComponent(r.orderRef)}`}
                    className="inline-flex min-h-9 w-full shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-center text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 sm:w-auto sm:min-h-8 sm:min-w-[3.25rem] sm:px-2.5 sm:py-1"
                    title="Open return in app"
                  >
                    View
                  </Link>
                )}
                {actionsDisabled ? (
                  <span
                    className="inline-flex min-h-9 w-full shrink-0 cursor-not-allowed items-center justify-center rounded-md border border-zinc-300 bg-zinc-200 px-2 py-1.5 text-center text-xs font-semibold leading-tight text-zinc-500 shadow-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-500 sm:w-auto sm:min-h-8 sm:px-2.5 sm:py-1"
                    title={greyedRowActionsTitle}
                    aria-disabled="true"
                  >
                    <span className="sm:hidden">Shopify refund</span>
                    <span className="hidden sm:inline">Refund in Shopify</span>
                  </span>
                ) : (
                  <ShopifyRefundAuditButton
                    href={shopifyReturnLogRowAdminHref(
                      r,
                      shopifyAdminIdByOrderRef,
                    )}
                    orderRef={r.orderRef}
                    returnLogId={r.returnUid}
                    refundAmountGbp={r.totalRefundGbp}
                    currency="GBP"
                    {...shopifyAuditCustomersForReturnRow(
                      r,
                      shopifyDisplayByOrderRef,
                    )}
                    shopifyOrderId={shopifyReturnLogRowAdminOrderId(
                      r,
                      shopifyAdminIdByOrderRef,
                    )}
                    className="inline-flex min-h-9 w-full shrink-0 items-center justify-center rounded-md border border-[#006e52] bg-[#008060] px-2 py-1.5 text-center text-xs font-semibold leading-tight text-white shadow-sm transition-colors hover:bg-[#006e52] focus:outline-none focus:ring-2 focus:ring-[#008060] focus:ring-offset-1 enabled:cursor-pointer disabled:cursor-not-allowed dark:focus:ring-offset-zinc-950 sm:w-auto sm:min-h-8 sm:px-2.5 sm:py-1"
                    title="Log refund intent, then open Shopify Admin refund (new tab)"
                    disabled={actionsDisabled}
                    fullOrderRefund={loggedReturnIsFullShopifyOrder(
                      r,
                      shopifyDisplayByOrderRef,
                    )}
                  >
                    <span className="sm:hidden">Shopify refund</span>
                    <span className="hidden sm:inline">Refund in Shopify</span>
                  </ShopifyRefundAuditButton>
                )}
              </div>
            </td>
          </tr>
          {lines.length > 0 ? (
            <tr
              className={
                greyed
                  ? "bg-zinc-100/90 text-zinc-600 dark:bg-zinc-900/55 dark:text-zinc-400"
                  : "bg-zinc-50/90 text-zinc-800 dark:bg-zinc-950/25 dark:text-zinc-200"
              }
            >
              <td
                colSpan={9}
                className="border-t border-zinc-200 px-3 py-2.5 align-top text-xs leading-relaxed dark:border-zinc-800"
              >
                <p className="mb-1.5 font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Line detail
                </p>
                <ul className="space-y-2">
                  {lines.map((line) => (
                    <li
                      key={line.lineId}
                      className={`border-l-2 pl-2 ${returnLineDispositionListBorderClass(line.disposition)}`}
                    >
                      <span className="font-medium text-foreground">{line.title}</span>
                      <span className="mt-0.5 block text-zinc-600 dark:text-zinc-400">
                        <span className="font-medium text-zinc-500 dark:text-zinc-400">
                          Reason:{" "}
                        </span>
                        {line.reasonLabel}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="font-medium text-zinc-500 dark:text-zinc-400">
                          Handling
                        </span>
                        <span
                          className={returnLineDispositionHandlingPillClass(
                            line.disposition,
                            greyed,
                          )}
                        >
                          {returnLineHandlingListingLabel(line)}
                        </span>
                      </span>
                      {line.notes?.trim() ? (
                        <span className="mt-1 block whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                          Notes: {line.notes.trim()}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ) : null}
        </Fragment>
      );
    });

  const renderMobileReturnCard = (r: ReturnLogListItem) => {
    const lines = r.lines ?? [];
    const greyed = shopifyRefundedByReturnUid.get(r.returnUid) === true;
    const actionsDisabled = greyed;
    const cardBase = greyed
      ? "rounded-xl border border-zinc-300 bg-zinc-100/90 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/55 dark:text-zinc-400"
      : "rounded-xl border border-zinc-200 bg-white text-foreground dark:border-zinc-800 dark:bg-zinc-950/40";
    const strongText = greyed
      ? "text-zinc-600 dark:text-zinc-400"
      : "text-foreground";
    const mutedText = greyed
      ? "text-zinc-500 dark:text-zinc-500"
      : "text-zinc-500 dark:text-zinc-400";
    const yesNoEmail = r.customerEmailSent
      ? greyed
        ? "text-zinc-500 dark:text-zinc-400"
        : "text-emerald-700 dark:text-emerald-400"
      : mutedText;
    const yesNoRefund = r.refunded
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";
    return (
      <section className={cardBase}>
        <div className="border-b border-zinc-100 px-3 py-3 dark:border-zinc-800/80">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Order and refund status
          </p>
          <dl className="mt-2 grid grid-cols-[minmax(0,7.5rem)_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className={mutedText}>Logged</dt>
            <dd className={`font-medium tabular-nums ${strongText}`}>
              {fmtWhen(r.createdAt)}
            </dd>
            <dt className={mutedText} title="PIN signature or legacy 1/2">
              By
            </dt>
            <dd
              className={`font-medium ${strongText}`}
              title="Who logged this return"
            >
              {warehouseReturnAuditListCell(r.loggedByOperator, r.loggedByRole)}
            </dd>
            <dt className={mutedText}>Order</dt>
            <dd
              className={`break-all font-mono text-xs font-semibold ${strongText}`}
            >
              {r.orderRef}
            </dd>
            <dt className={mutedText}>Lines</dt>
            <dd className={`font-medium ${strongText}`}>{r.lineCount}</dd>
            <dt className={mutedText}>Value</dt>
            <dd className={`font-medium tabular-nums ${strongText}`}>
              {formatGbp(r.totalRefundGbp)}
            </dd>
            <dt className={mutedText}>Email</dt>
            <dd className={`font-medium ${yesNoEmail}`}>
              {r.customerEmailSent ? "Yes" : "No"}
            </dd>
            <dt className={mutedText}>Refund</dt>
            <dd className={`font-medium ${yesNoRefund}`}>
              {r.refunded ? "Yes" : "No"}
            </dd>
            <dt className={mutedText}>Shopify payment</dt>
            <dd className={`text-sm normal-case ${strongText}`}>
              {shopifyPaymentStatusLabelForReturnsList(
                shopifyDisplayByOrderRef.get(r.orderRef.trim()) ?? null,
              )}
            </dd>
          </dl>
          <div className="mt-3 flex gap-2">
            {actionsDisabled ? (
              <span
                className="inline-flex min-h-9 flex-1 cursor-not-allowed items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 px-2 py-1.5 text-xs font-semibold text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-500"
                title={greyedRowActionsTitle}
                aria-disabled="true"
              >
                View
              </span>
            ) : (
              <Link
                href={`/returns/${encodeURIComponent(r.orderRef)}`}
                className="inline-flex min-h-9 flex-1 items-center justify-center rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs font-semibold text-foreground shadow-sm dark:border-zinc-600 dark:bg-zinc-900"
              >
                View
              </Link>
            )}
            {actionsDisabled ? (
              <span
                className="inline-flex min-h-9 flex-1 cursor-not-allowed items-center justify-center rounded-md border border-zinc-300 bg-zinc-200 px-2 py-1.5 text-xs font-semibold text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-500"
                title={greyedRowActionsTitle}
                aria-disabled="true"
              >
                Shopify refund
              </span>
            ) : (
              <ShopifyRefundAuditButton
                href={shopifyReturnLogRowAdminHref(r, shopifyAdminIdByOrderRef)}
                orderRef={r.orderRef}
                returnLogId={r.returnUid}
                refundAmountGbp={r.totalRefundGbp}
                currency="GBP"
                {...shopifyAuditCustomersForReturnRow(r, shopifyDisplayByOrderRef)}
                shopifyOrderId={shopifyReturnLogRowAdminOrderId(
                  r,
                  shopifyAdminIdByOrderRef,
                )}
                className="inline-flex min-h-9 flex-1 items-center justify-center rounded-md border border-[#006e52] bg-[#008060] px-2 py-1.5 text-xs font-semibold text-white enabled:cursor-pointer disabled:cursor-not-allowed"
                title="Log refund intent, then open Shopify Admin refund (new tab)"
                disabled={actionsDisabled}
                fullOrderRefund={loggedReturnIsFullShopifyOrder(
                  r,
                  shopifyDisplayByOrderRef,
                )}
              >
                Shopify refund
              </ShopifyRefundAuditButton>
            )}
          </div>
        </div>
        <div className="px-3 pt-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Items to refund
          </p>
        </div>
        {lines.length === 0 ? (
          <p className="px-3 pb-3 pt-1 text-sm text-zinc-500">
            No line items stored for this return.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {lines.map((line) => {
              const { product, size, colour } =
                parseReturnLogLineTitleForMobile(line.title);
              return (
                <li key={line.lineId} className="px-3 py-3">
                  <p
                    className={`text-sm font-medium leading-snug ${
                      greyed
                        ? "text-zinc-600 dark:text-zinc-400"
                        : "text-foreground"
                    }`}
                  >
                    {product}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                    <div>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        Size
                      </span>
                      <p
                        className={`font-medium ${
                          greyed
                            ? "text-zinc-600 dark:text-zinc-400"
                            : "text-foreground"
                        }`}
                      >
                        {size}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        Colour
                      </span>
                      <p
                        className={`font-medium ${
                          greyed
                            ? "text-zinc-600 dark:text-zinc-400"
                            : "text-foreground"
                        }`}
                      >
                        {colour}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`mt-2 text-sm font-semibold tabular-nums ${
                      greyed
                        ? "text-zinc-600 dark:text-zinc-400"
                        : "text-foreground"
                    }`}
                  >
                    {formatGbp(line.lineTotalGbp)}
                  </p>
                  <p
                    className={`mt-2 text-xs ${
                      greyed
                        ? "text-zinc-500 dark:text-zinc-500"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <span className="font-medium text-zinc-500 dark:text-zinc-400">
                      Reason:{" "}
                    </span>
                    {line.reasonLabel}
                  </p>
                  <div
                    className={`mt-1 flex flex-wrap items-center gap-2 text-xs ${
                      greyed
                        ? "text-zinc-500 dark:text-zinc-500"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <span className="font-medium text-zinc-500 dark:text-zinc-400">
                      Handling
                    </span>
                    <span
                      className={returnLineDispositionHandlingPillClass(
                        line.disposition,
                        greyed,
                      )}
                    >
                      {returnLineHandlingListingLabel(line)}
                    </span>
                  </div>
                  {line.notes?.trim() ? (
                    <p
                      className={`mt-1 whitespace-pre-wrap text-xs ${
                        greyed
                          ? "text-zinc-500 dark:text-zinc-500"
                          : "text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <span className="font-medium text-zinc-500 dark:text-zinc-400">
                        Notes:{" "}
                      </span>
                      {line.notes.trim()}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  };

  return (
    <div className="mx-auto min-w-0 max-w-5xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold sm:text-2xl">
            {q.refundPending ? "Returns awaiting refund" : "Logged returns"}
          </h1>
          <RefundedTodaySoFar className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400" />
        </div>
        <Link
          href="/returns"
          className="inline-flex w-full shrink-0 items-center justify-center self-start rounded-md bg-foreground px-2.5 py-2 text-xs font-semibold text-background shadow-sm transition-colors hover:bg-foreground/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground sm:w-auto sm:py-1.5"
        >
          New return
        </Link>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-1.5">
        <Link
          href={returnLogListHref(current, {
            page: 1,
            refundPending: true,
          })}
          className={
            q.refundPending
              ? "inline-flex w-full items-center justify-center rounded-md bg-foreground px-2.5 py-2 text-center text-xs font-semibold text-background shadow-sm sm:w-auto sm:py-1.5"
              : "inline-flex w-full items-center justify-center rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-center text-xs font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 sm:w-auto sm:py-1.5"
          }
        >
          Outstanding refunds
        </Link>
        <Link
          href={returnLogListHref(current, {
            page: 1,
            refundPending: false,
          })}
          className={
            !q.refundPending
              ? "inline-flex w-full items-center justify-center rounded-md bg-foreground px-2.5 py-2 text-center text-xs font-semibold text-background shadow-sm sm:w-auto sm:py-1.5"
              : "inline-flex w-full items-center justify-center rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-center text-xs font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 sm:w-auto sm:py-1.5"
          }
        >
          <span className="sm:hidden">All returns</span>
          <span className="hidden sm:inline">View all returns</span>
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
      ) : (
        <>
          <div className="mt-3 flex flex-col gap-2 text-sm text-zinc-500 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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

          {q.refundPending ? (
            <>
              <div className="mt-3 hidden flex-col gap-2 lg:flex">
                <div className="flex justify-end">
                  <ReturnLogRefreshButton />
                </div>
                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full min-w-[40rem] border-collapse text-left text-sm md:min-w-[48rem]">
                    {refundPendingDesktopThead}
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                      {renderDesktopTableRows(displayRows)}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-3 lg:hidden">
                <div className="flex justify-end">
                  <ReturnLogRefreshButton />
                </div>
                <div className="space-y-4">
                  {displayRows.map((r) => (
                    <Fragment key={r.returnUid}>
                      {renderMobileReturnCard(r)}
                    </Fragment>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm md:min-w-[48rem]">
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
                    <th
                      className="px-3 py-2.5 font-semibold text-foreground sm:px-4"
                      title="Staff marked refunded on this return (returnLogs.refunded)"
                    >
                      <Link
                        href={returnLogListSortHeaderHref(current, "refund")}
                        className="inline-flex items-center font-semibold text-foreground underline decoration-zinc-300 underline-offset-2 transition-colors hover:decoration-foreground"
                      >
                        Refund
                        <span className="text-zinc-400" aria-hidden>
                          {sortHeaderArrow(q.sort, q.order, "refund")}
                        </span>
                      </Link>
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {displayRows.map((r) => {
                    return (
                      <Fragment key={r.returnUid}>
                        <tr className="text-zinc-800 dark:text-zinc-200">
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
                              r.refunded
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {r.refunded ? "Yes" : "No"}
                          </td>
                          <td className="px-2 py-3 sm:px-4">
                            <div className="flex max-w-[10.5rem] flex-col gap-2 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:gap-1.5 lg:max-w-none">
                              <Link
                                href={`/returns/${encodeURIComponent(r.orderRef)}`}
                                className="inline-flex min-h-9 w-full shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-center text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 sm:w-auto sm:min-h-8 sm:min-w-[3.25rem] sm:px-2.5 sm:py-1"
                                title="Open return in app"
                              >
                                View
                              </Link>
                              <ShopifyRefundAuditButton
                                href={shopifyReturnLogRowAdminHref(
                                  r,
                                  shopifyAdminIdByOrderRef,
                                )}
                                orderRef={r.orderRef}
                                returnLogId={r.returnUid}
                                refundAmountGbp={r.totalRefundGbp}
                                currency="GBP"
                                {...shopifyAuditCustomersForReturnRow(
                                  r,
                                  shopifyDisplayByOrderRef,
                                )}
                                shopifyOrderId={shopifyReturnLogRowAdminOrderId(
                                  r,
                                  shopifyAdminIdByOrderRef,
                                )}
                                className="inline-flex min-h-9 w-full shrink-0 items-center justify-center rounded-md border border-[#006e52] bg-[#008060] px-2 py-1.5 text-center text-xs font-semibold leading-tight text-white shadow-sm transition-colors hover:bg-[#006e52] focus:outline-none focus:ring-2 focus:ring-[#008060] focus:ring-offset-1 enabled:cursor-pointer disabled:cursor-not-allowed dark:focus:ring-offset-zinc-950 sm:w-auto sm:min-h-8 sm:px-2.5 sm:py-1"
                                title="Log refund intent, then open Shopify Admin refund (new tab)"
                                disabled={false}
                                fullOrderRefund={loggedReturnIsFullShopifyOrder(
                                  r,
                                  shopifyDisplayByOrderRef,
                                )}
                              >
                                <span className="sm:hidden">Shopify refund</span>
                                <span className="hidden sm:inline">
                                  Refund in Shopify
                                </span>
                              </ShopifyRefundAuditButton>
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex flex-col items-stretch gap-3 border-t border-zinc-200 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
            <p
              className="text-pretty text-zinc-600 dark:text-zinc-400"
              aria-live="polite"
            >
              {q.refundPending ? (
                <>
                  <span className="block sm:inline">
                    Showing {displayRows.length} return
                    {displayRows.length === 1 ? "" : "s"} on this page.
                  </span>{" "}
                  <span className="mt-1 block text-xs sm:mt-0 sm:inline sm:text-sm">
                    DB filter: {from}–{to} of {total} with refund not marked in app.
                  </span>
                </>
              ) : (
                <>
                  {from}–{to} of {total} return{total === 1 ? "" : "s"}
                </>
              )}
            </p>
            <div className="grid w-full min-w-0 max-w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:gap-2">
              <Link
                href={returnLogListPageHref(current, Math.max(1, page - 1))}
                className={
                  page <= 1
                    ? "pointer-events-none col-start-1 row-start-1 flex min-h-11 cursor-not-allowed items-center justify-center rounded-lg border border-zinc-200 px-3 py-2 text-center text-sm text-zinc-400 dark:border-zinc-800 sm:order-1 sm:min-h-0 sm:py-1.5"
                    : "col-start-1 row-start-1 flex min-h-11 items-center justify-center rounded-lg border border-zinc-200 px-3 py-2 text-center text-sm font-medium text-foreground hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 sm:order-1 sm:min-h-0 sm:py-1.5"
                }
                aria-disabled={page <= 1}
                tabIndex={page <= 1 ? -1 : 0}
              >
                Previous
              </Link>
              <Link
                href={returnLogListPageHref(
                  current,
                  Math.min(lastPage, page + 1),
                )}
                className={
                  page >= lastPage
                    ? "pointer-events-none col-start-2 row-start-1 flex min-h-11 cursor-not-allowed items-center justify-center rounded-lg border border-zinc-200 px-3 py-2 text-center text-sm text-zinc-400 dark:border-zinc-800 sm:order-3 sm:min-h-0 sm:py-1.5"
                    : "col-start-2 row-start-1 flex min-h-11 items-center justify-center rounded-lg border border-zinc-200 px-3 py-2 text-center text-sm font-medium text-foreground hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 sm:order-3 sm:min-h-0 sm:py-1.5"
                }
                aria-disabled={page >= lastPage}
                tabIndex={page >= lastPage ? -1 : 0}
              >
                Next
              </Link>
              <span
                className="col-span-2 row-start-2 text-center text-sm text-zinc-500 sm:order-2 sm:col-auto sm:row-auto sm:shrink-0 sm:px-1"
                aria-label="Page numbers"
              >
                Page {page} of {lastPage}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
