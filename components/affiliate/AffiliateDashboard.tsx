"use client";

import { useEffect, useState } from "react";
import { Check, Copy, List } from "@phosphor-icons/react";
import { AffiliateAreaChart } from "@/components/affiliate/AffiliateAreaChart";
import { AffiliateSidebar } from "@/components/affiliate/AffiliateSidebar";
import {
  fetchAffiliateClicks,
  fetchAffiliateCodeUsage,
  fetchAffiliateDashboard,
  fetchAffiliateEarnings,
  fetchAffiliateOrders,
  formatAffiliateDiscount,
  formatChangePct,
  formatGbp,
  formatInt,
} from "@/lib/affiliate/api";
import type {
  AffiliateAccount,
  AffiliateDashboardData,
  AffiliateNavId,
  AffiliateOrderRow,
  AffiliateRange,
  AffiliateSeriesPoint,
} from "@/lib/affiliate/types";

const STOREFRONT_BASE = "https://kokobay.co.uk";

const RANGE_OPTIONS: { value: AffiliateRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

function affiliateShareUrl(discountCode: string): string {
  const code = discountCode.trim().toUpperCase();
  return `${STOREFRONT_BASE}?ref=${encodeURIComponent(code)}`;
}

function CopyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8A8580]">
        {label}
      </p>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 break-all rounded-xl border border-[#E4DED6] bg-[#FBF9F7] px-3.5 py-2.5 text-sm font-medium text-[#1A1A1A]">
          {value}
        </p>
        <button
          type="button"
          onClick={() => {
            void (async () => {
              try {
                await navigator.clipboard.writeText(value);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            })();
          }}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#E4DED6] bg-white px-3.5 text-sm text-[#3D3A36] shadow-sm hover:bg-[#FBF9F7]"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-emerald-600" weight="bold" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy
            </>
          )}
        </button>
      </div>
      {hint ? <p className="mt-1.5 text-xs text-[#8A8580]">{hint}</p> : null}
    </div>
  );
}

function AffiliateShareCard({ account }: { account: AffiliateAccount }) {
  const shareUrl = affiliateShareUrl(account.discountCode);
  return (
    <section className="rounded-2xl border border-[#EBE6E0] bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)] sm:p-6">
      <p className="text-base text-[#1A1A1A]">Your link &amp; code</p>
      <p className="mt-1 text-sm text-[#7A746C]">
        Share this link so clicks are tracked. Shoppers can use your discount
        code for {formatAffiliateDiscount(account)} off.
      </p>
      <div className="mt-5 grid gap-5">
        <CopyField
          label="Discount code"
          value={account.discountCode}
          hint={`Customer discount: ${formatAffiliateDiscount(account)} · Your commission: ${account.earningsPercent}%`}
        />
        <CopyField
          label="Share link"
          value={shareUrl}
          hint="Example: https://kokobay.co.uk?ref=YOURCODE"
        />
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  changePct,
}: {
  label: string;
  value: string;
  changePct: number | null;
}) {
  const change = formatChangePct(changePct);
  return (
    <div className="rounded-2xl border border-[#EBE6E0] bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)]">
      <p className="text-sm text-[#7A746C]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-[#1A1A1A]">
        {value}
      </p>
      {change ? (
        <p
          className={`mt-2 text-sm font-medium tabular-nums ${
            changePct != null && changePct < 0
              ? "text-rose-600"
              : "text-emerald-600"
          }`}
        >
          {change}
        </p>
      ) : (
        <p className="mt-2 text-sm text-[#A39E97]">—</p>
      )}
    </div>
  );
}

function MobileStatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#EFEAE4] py-3.5 last:border-b-0">
      <span className="text-sm text-[#7A746C]">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-[#1A1A1A]">
        {value}
      </span>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-[#EBE6E0]/80 ${className ?? ""}`}
      aria-hidden
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[#EBE6E0] bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)]"
          >
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-3 h-8 w-28" />
            <Skeleton className="mt-3 h-4 w-14" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-[#EBE6E0] bg-white px-4 py-2 sm:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-[#EFEAE4] py-3.5 last:border-b-0"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-[#EBE6E0] bg-white p-5 sm:p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-6 h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}

function ChartPanelSkeleton({ titleWidth = "w-40" }: { titleWidth?: string }) {
  return (
    <section
      className="rounded-2xl border border-[#EBE6E0] bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)] sm:p-6"
      aria-busy="true"
    >
      <Skeleton className={`h-5 ${titleWidth}`} />
      <Skeleton className="mt-3 h-4 w-56" />
      <Skeleton className="mt-6 h-48 w-full rounded-xl" />
    </section>
  );
}

function OrdersSkeleton() {
  return (
    <section
      className="overflow-hidden rounded-2xl border border-[#EBE6E0] bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)]"
      aria-busy="true"
    >
      <div className="border-b border-[#EFEAE4] px-5 py-4">
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="space-y-3 px-5 py-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </section>
  );
}

function EarningsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[#EBE6E0] bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)]"
        >
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-8 w-32" />
          <Skeleton className="mt-3 h-4 w-40" />
        </div>
      ))}
    </div>
  );
}

export function AffiliateDashboard({
  account,
  onLogout,
}: {
  account: AffiliateAccount;
  onLogout: () => void;
}) {
  const [nav, setNav] = useState<AffiliateNavId>("dashboard");
  const [range, setRange] = useState<AffiliateRange>("30d");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [dashboard, setDashboard] = useState<AffiliateDashboardData | null>(null);
  const [clicks, setClicks] = useState<{
    total: number;
    changePct: number | null;
    series: AffiliateSeriesPoint[];
  } | null>(null);
  const [codeUsage, setCodeUsage] = useState<{
    total: number;
    changePct: number | null;
    series: AffiliateSeriesPoint[];
  } | null>(null);
  const [orders, setOrders] = useState<AffiliateOrderRow[]>([]);
  const [earnings, setEarnings] = useState<{
    earnings: number;
    orders: number;
    earningsPercent: number;
    changePct: number | null;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);

      if (nav === "dashboard") {
        const result = await fetchAffiliateDashboard(range);
        if (!result.ok) {
          setError(result.error);
          setDashboard(null);
        } else {
          setDashboard(result.data);
        }
      } else if (nav === "clicks") {
        const result = await fetchAffiliateClicks(range);
        if (!result.ok) {
          setError(result.error);
          setClicks(null);
        } else {
          setClicks(result);
        }
      } else if (nav === "codeUsage") {
        const result = await fetchAffiliateCodeUsage(range);
        if (!result.ok) {
          setError(result.error);
          setCodeUsage(null);
        } else {
          setCodeUsage(result);
        }
      } else if (nav === "orders") {
        const result = await fetchAffiliateOrders(range);
        if (!result.ok) {
          setError(result.error);
          setOrders([]);
        } else {
          setOrders(result.orders);
        }
      } else if (nav === "earnings") {
        const result = await fetchAffiliateEarnings(range);
        if (!result.ok) {
          setError(result.error);
          setEarnings(null);
        } else {
          setEarnings(result);
        }
      }

      setLoading(false);
    })();
  }, [nav, range]);

  const title =
    nav === "dashboard"
      ? "Dashboard"
      : nav === "clicks"
        ? "Clicks"
        : nav === "codeUsage"
          ? "Code Usage"
          : nav === "orders"
            ? "Orders"
            : nav === "earnings"
              ? "Earnings"
              : nav === "payments"
                ? "Payments"
                : "Profile";

  const showRange =
    nav === "dashboard" ||
    nav === "clicks" ||
    nav === "codeUsage" ||
    nav === "orders" ||
    nav === "earnings";

  return (
    <div className="flex min-h-full flex-1 bg-[#F7F5F2] text-[#1A1A1A]">
      <AffiliateSidebar
        active={nav}
        onNavigate={setNav}
        onLogout={onLogout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[#EBE6E0] bg-[#FBF9F7]/90 px-4 py-3 backdrop-blur lg:hidden">
          <p className="text-sm tracking-[0.18em]">KOKO BAY</p>
          <button
            type="button"
            className="rounded-lg p-2 text-[#5C574F]"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <List className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-5xl">
            <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="hidden text-2xl tracking-tight text-[#1A1A1A] lg:block">
                  Welcome back, {account.displayName}{" "}
                  <span aria-hidden>✨</span>
                </p>
                <p className="text-2xl tracking-tight text-[#1A1A1A] lg:hidden">
                  {title}
                </p>
                <p className="mt-1 text-sm text-[#7A746C]">
                  Commission {account.earningsPercent}% · Code{" "}
                  <span className="font-medium text-[#3D3A36]">
                    {account.discountCode}
                  </span>{" "}
                  ({formatAffiliateDiscount(account)})
                </p>
              </div>
              {showRange ? (
                <select
                  id="affiliate-range"
                  aria-label="Date range"
                  value={range}
                  onChange={(e) => setRange(e.target.value as AffiliateRange)}
                  className="w-full rounded-xl border border-[#E4DED6] bg-white px-3.5 py-2.5 text-sm text-[#3D3A36] shadow-sm outline-none focus:border-[#E89292] sm:w-auto"
                >
                  {RANGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            {error ? (
              <p className="mb-4 text-sm text-rose-700" role="alert">
                {error}
              </p>
            ) : null}

            {(nav === "dashboard" || nav === "profile") && (
              <div className="mb-6">
                <AffiliateShareCard account={account} />
              </div>
            )}

            {loading && nav === "dashboard" ? <DashboardSkeleton /> : null}
            {loading && (nav === "clicks" || nav === "codeUsage") ? (
              <ChartPanelSkeleton
                titleWidth={nav === "codeUsage" ? "w-48" : "w-40"}
              />
            ) : null}
            {loading && nav === "orders" ? <OrdersSkeleton /> : null}
            {loading && nav === "earnings" ? <EarningsSkeleton /> : null}

            {!loading && nav === "dashboard" && dashboard ? (
              <div className="space-y-6">
                <div className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Clicks"
                    value={formatInt(dashboard.clicks)}
                    changePct={dashboard.changePct.clicks}
                  />
                  <StatCard
                    label="Code Uses"
                    value={formatInt(dashboard.codeUses)}
                    changePct={dashboard.changePct.codeUses}
                  />
                  <StatCard
                    label="Orders"
                    value={formatInt(dashboard.orders)}
                    changePct={dashboard.changePct.orders}
                  />
                  <StatCard
                    label="Earnings"
                    value={formatGbp(dashboard.earnings)}
                    changePct={dashboard.changePct.earnings}
                  />
                </div>
                <div className="rounded-2xl border border-[#EBE6E0] bg-white px-4 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)] sm:hidden">
                  <MobileStatRow
                    label="Clicks"
                    value={formatInt(dashboard.clicks)}
                  />
                  <MobileStatRow
                    label="Code Uses"
                    value={formatInt(dashboard.codeUses)}
                  />
                  <MobileStatRow
                    label="Orders"
                    value={formatInt(dashboard.orders)}
                  />
                  <MobileStatRow
                    label="Earnings"
                    value={formatGbp(dashboard.earnings)}
                  />
                </div>

                <section className="rounded-2xl border border-[#EBE6E0] bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)] sm:p-6">
                  <p className="text-base text-[#1A1A1A]">Clicks Over Time</p>
                  <div className="mt-4">
                    <AffiliateAreaChart
                      series={dashboard.clicksSeries}
                      ariaLabel="Clicks over time chart"
                    />
                  </div>
                </section>
              </div>
            ) : null}

            {!loading && nav === "clicks" && clicks ? (
              <section className="rounded-2xl border border-[#EBE6E0] bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)] sm:p-6">
                <p className="text-base text-[#1A1A1A]">Clicks Over Time</p>
                <p className="mt-1 text-sm text-[#7A746C]">
                  {formatInt(clicks.total)} clicks
                  {formatChangePct(clicks.changePct)
                    ? ` (${formatChangePct(clicks.changePct)})`
                    : ""}
                </p>
                <div className="mt-4">
                  <AffiliateAreaChart
                    series={clicks.series}
                    ariaLabel="Clicks over time chart"
                  />
                </div>
              </section>
            ) : null}

            {!loading && nav === "codeUsage" && codeUsage ? (
              <section className="rounded-2xl border border-[#EBE6E0] bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)] sm:p-6">
                <p className="text-base text-[#1A1A1A]">Discount code usage</p>
                <p className="mt-1 text-sm text-[#7A746C]">
                  Code{" "}
                  <span className="font-medium text-[#3D3A36]">
                    {account.discountCode}
                  </span>{" "}
                  used {formatInt(codeUsage.total)} times
                  {formatChangePct(codeUsage.changePct)
                    ? ` (${formatChangePct(codeUsage.changePct)})`
                    : ""}
                </p>
                <div className="mt-4">
                  <AffiliateAreaChart
                    series={codeUsage.series}
                    ariaLabel="Code usage over time"
                  />
                </div>
              </section>
            ) : null}

            {!loading && nav === "orders" ? (
              <section className="overflow-hidden rounded-2xl border border-[#EBE6E0] bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)]">
                <div className="border-b border-[#EFEAE4] px-5 py-4">
                  <p className="text-base text-[#1A1A1A]">Orders</p>
                </div>
                {orders.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-[#7A746C]">
                    No attributed orders in this period.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[28rem] text-left text-sm">
                      <thead className="bg-[#FBF9F7] text-[#7A746C]">
                        <tr>
                          <th className="px-5 py-3 font-medium">Order</th>
                          <th className="px-5 py-3 font-medium">Date</th>
                          <th className="px-5 py-3 font-medium">Total</th>
                          <th className="px-5 py-3 font-medium">Your earning</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((o) => (
                          <tr key={o.id} className="border-t border-[#EFEAE4]">
                            <td className="px-5 py-3 tabular-nums">
                              {o.orderName ?? o.shopifyOrderId}
                            </td>
                            <td className="px-5 py-3 text-[#5C574F]">
                              {new Date(o.orderedAt).toLocaleDateString("en-GB")}
                            </td>
                            <td className="px-5 py-3 tabular-nums">
                              {formatGbp(o.orderSubtotal, o.currency)}
                            </td>
                            <td className="px-5 py-3 font-medium tabular-nums">
                              {formatGbp(o.earning, o.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : null}

            {!loading && nav === "earnings" && earnings ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#EBE6E0] bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)]">
                  <p className="text-sm text-[#7A746C]">Period earnings</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
                    {formatGbp(earnings.earnings)}
                  </p>
                  <p className="mt-2 text-sm text-[#7A746C]">
                    {formatInt(earnings.orders)} orders
                    {formatChangePct(earnings.changePct)
                      ? ` · ${formatChangePct(earnings.changePct)}`
                      : ""}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#EBE6E0] bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)]">
                  <p className="text-sm text-[#7A746C]">Your commission rate</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
                    {earnings.earningsPercent}%
                  </p>
                  <p className="mt-2 text-sm text-[#7A746C]">
                    Applied to discount code orders
                  </p>
                </div>
              </div>
            ) : null}

            {!loading && nav === "payments" ? (
              <section className="rounded-2xl border border-[#EBE6E0] bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)] sm:p-6">
                <p className="text-base text-[#1A1A1A]">Payments</p>
                <p className="mt-2 text-sm text-[#7A746C]">
                  Payout history isn&apos;t available from the API yet.
                </p>
              </section>
            ) : null}

            {!loading && nav === "profile" ? (
              <section className="rounded-2xl border border-[#EBE6E0] bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)] sm:p-6">
                <p className="text-base text-[#1A1A1A]">Profile</p>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-[#8A8580]">
                      Name
                    </dt>
                    <dd className="mt-1 text-sm">{account.displayName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-[#8A8580]">
                      Login code
                    </dt>
                    <dd className="mt-1 text-sm tabular-nums">{account.code}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-[#8A8580]">
                      Earnings percent
                    </dt>
                    <dd className="mt-1 text-sm">{account.earningsPercent}%</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-[#8A8580]">
                      Max uses / customer
                    </dt>
                    <dd className="mt-1 text-sm">
                      {account.maxUsesPerCustomer ?? "Unlimited"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-[#8A8580]">
                      Total usage limit
                    </dt>
                    <dd className="mt-1 text-sm">
                      {account.usageLimit ?? "Unlimited"}
                    </dd>
                  </div>
                </dl>
              </section>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
