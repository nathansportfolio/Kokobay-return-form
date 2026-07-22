"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash } from "@phosphor-icons/react";
import {
  createAffiliateAccount,
  deleteAffiliateAccount,
  fetchAffiliateAdminOverview,
  formatAffiliateDiscount,
  formatGbp,
  formatInt,
} from "@/lib/affiliate/api";
import type {
  AffiliateAccount,
  AffiliateAdminOverview,
  AffiliateAdminOverviewRow,
  AffiliateDiscountType,
} from "@/lib/affiliate/types";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-[#E4DED6] bg-[#FBF9F7] px-3.5 py-2.5 text-sm outline-none focus:border-[#E89292] focus:ring-2 focus:ring-[#E89292]/30";

/** Customer-facing percentage discount hard cap. */
const MAX_DISCOUNT_PERCENT = 30;
/** Affiliate commission hard cap. */
const MAX_EARNINGS_PERCENT = 40;

function OverviewStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#EBE6E0] bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)]">
      <p className="text-sm text-[#7A746C]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[#1A1A1A] sm:text-3xl">
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-[#8A8580]">{hint}</p> : null}
    </div>
  );
}

export function AffiliateAdmin({
  account,
  onLogout,
}: {
  account: AffiliateAccount;
  onLogout: () => void;
}) {
  const [overview, setOverview] = useState<AffiliateAdminOverview | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [discountType, setDiscountType] =
    useState<AffiliateDiscountType>("percentage");
  const [discountValue, setDiscountValue] = useState("10");
  const [usageLimit, setUsageLimit] = useState("");
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState("1");
  const [earningsPercent, setEarningsPercent] = useState("10");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setListError(null);
    const result = await fetchAffiliateAdminOverview();
    if (!result.ok) {
      setListError(result.error);
      setOverview(null);
      return;
    }
    setOverview(result.overview);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoadingList(true);
      await refresh();
      setLoadingList(false);
    })();
  }, [refresh]);

  function resetForm() {
    setCode("");
    setPin("");
    setDisplayName("");
    setDiscountCode("");
    setDiscountType("percentage");
    setDiscountValue("10");
    setUsageLimit("");
    setMaxUsesPerCustomer("1");
    setEarningsPercent("10");
  }

  const affiliates: AffiliateAdminOverviewRow[] = overview?.affiliates ?? [];

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#F7F5F2] text-[#1A1A1A]">
      <header className="flex items-center justify-between border-b border-[#EBE6E0] bg-[#FBF9F7] px-4 py-4 sm:px-6">
        <div>
          <p className="text-sm tracking-[0.18em]">KOKO BAY</p>
          <p className="mt-0.5 text-sm text-[#7A746C]">
            Affiliate admin · {account.displayName}
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-xl border border-[#E4DED6] bg-white px-3.5 py-2 text-sm text-[#3D3A36] shadow-sm hover:bg-[#FBF9F7]"
        >
          Log out
        </button>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loadingList && !overview ? (
            <>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[6.5rem] animate-pulse rounded-2xl border border-[#EBE6E0] bg-[#EBE6E0]/50"
                />
              ))}
            </>
          ) : (
            <>
              <OverviewStat
                label="Total affiliate revenue"
                value={formatGbp(overview?.totals?.revenue ?? 0)}
                hint="Order subtotals from all affiliate discount codes"
              />
              <OverviewStat
                label="Commission owed"
                value={formatGbp(overview?.totals?.commissionOwed ?? 0)}
                hint="Total commission across all affiliates"
              />
              <OverviewStat
                label="Net after commission"
                value={formatGbp(overview?.totals?.netRevenue ?? 0)}
                hint="Revenue minus commission owed"
              />
              <OverviewStat
                label="Attributed orders"
                value={formatInt(overview?.totals?.orders ?? 0)}
                hint={`${overview?.totals?.affiliateCount ?? 0} affiliate accounts`}
              />
            </>
          )}
        </section>

        <section className="rounded-2xl border border-[#EBE6E0] bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)] sm:p-6">
          <p className="text-base text-[#1A1A1A]">Create affiliate account</p>
          <p className="mt-1 text-sm text-[#7A746C]">
            Creates the affiliate login and a matching Shopify discount code.
          </p>

          <form
            className="mt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void (async () => {
                setError(null);
                setOkMsg(null);

                const discountNum = Number(discountValue);
                const earningsNum = Number(earningsPercent);

                if (
                  discountType === "percentage" &&
                  Number.isFinite(discountNum) &&
                  discountNum > MAX_DISCOUNT_PERCENT
                ) {
                  const msg = `Discount cannot exceed ${MAX_DISCOUNT_PERCENT}% off.`;
                  window.alert(msg);
                  setError(msg);
                  return;
                }
                if (
                  Number.isFinite(earningsNum) &&
                  earningsNum > MAX_EARNINGS_PERCENT
                ) {
                  const msg = `Commission cannot exceed ${MAX_EARNINGS_PERCENT}%.`;
                  window.alert(msg);
                  setError(msg);
                  return;
                }

                setBusy(true);
                const usageLimitTrim = usageLimit.trim();
                const maxUsesTrim = maxUsesPerCustomer.trim();
                const result = await createAffiliateAccount({
                  code,
                  pin,
                  displayName,
                  discountCode,
                  discountType,
                  discountValue: discountNum,
                  usageLimit:
                    usageLimitTrim === "" ? null : Number(usageLimitTrim),
                  maxUsesPerCustomer:
                    maxUsesTrim === "" ? null : Number(maxUsesTrim),
                  earningsPercent: earningsNum,
                });
                setBusy(false);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                const warn = result.warning ? ` ${result.warning}` : "";
                setOkMsg(
                  `Created ${result.account.code} · ${result.account.discountCode} (${formatAffiliateDiscount(result.account)}).${warn}`,
                );
                resetForm();
                await refresh();
              })();
            }}
          >
            <div>
              <label htmlFor="admin-name" className="text-sm font-medium">
                Display name
              </label>
              <input
                id="admin-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputClass}
                placeholder="Sophie"
              />
            </div>
            <div>
              <label htmlFor="admin-code" className="text-sm font-medium">
                Login code
              </label>
              <input
                id="admin-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={inputClass}
                placeholder="SOPHIE"
              />
            </div>
            <div>
              <label htmlFor="admin-pin" className="text-sm font-medium">
                PIN (4–8 digits)
              </label>
              <input
                id="admin-pin"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                className={`${inputClass} tracking-[0.3em]`}
                placeholder="1234"
              />
            </div>
            <div>
              <label htmlFor="admin-earnings" className="text-sm font-medium">
                Affiliate earnings % (max {MAX_EARNINGS_PERCENT}%)
              </label>
              <input
                id="admin-earnings"
                type="number"
                min={0}
                max={MAX_EARNINGS_PERCENT}
                step={1}
                value={earningsPercent}
                onChange={(e) => setEarningsPercent(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8A8580]">
                Shopify discount
              </p>
            </div>

            <div>
              <label htmlFor="admin-discount" className="text-sm font-medium">
                Discount code
              </label>
              <input
                id="admin-discount"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                className={inputClass}
                placeholder="SOPHIE10"
              />
            </div>
            <div>
              <label htmlFor="admin-dtype" className="text-sm font-medium">
                Discount type
              </label>
              <select
                id="admin-dtype"
                value={discountType}
                onChange={(e) =>
                  setDiscountType(e.target.value as AffiliateDiscountType)
                }
                className={inputClass}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed_amount">Fixed amount (£)</option>
              </select>
            </div>
            <div>
              <label htmlFor="admin-dvalue" className="text-sm font-medium">
                Discount value
                {discountType === "percentage"
                  ? ` (max ${MAX_DISCOUNT_PERCENT}%)`
                  : ""}
              </label>
              <input
                id="admin-dvalue"
                type="number"
                min={0}
                max={
                  discountType === "percentage"
                    ? MAX_DISCOUNT_PERCENT
                    : undefined
                }
                step={discountType === "percentage" ? 1 : 0.01}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className={inputClass}
                placeholder={discountType === "percentage" ? "10" : "5.00"}
              />
            </div>
            <div>
              <label htmlFor="admin-max-customer" className="text-sm font-medium">
                Max uses per customer
              </label>
              <input
                id="admin-max-customer"
                type="number"
                min={1}
                step={1}
                value={maxUsesPerCustomer}
                onChange={(e) => setMaxUsesPerCustomer(e.target.value)}
                className={inputClass}
                placeholder="1 (blank = unlimited)"
              />
              <p className="mt-1 text-xs text-[#8A8580]">
                Shopify basic codes enforce 1 or unlimited only
              </p>
            </div>
            <div>
              <label htmlFor="admin-usage-limit" className="text-sm font-medium">
                Total usage limit
              </label>
              <input
                id="admin-usage-limit"
                type="number"
                min={1}
                step={1}
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                className={inputClass}
                placeholder="Unlimited"
              />
              <p className="mt-1 text-xs text-[#8A8580]">Leave blank for unlimited</p>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1A1A1A] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" weight="bold" />
                {busy ? "Creating…" : "Create account"}
              </button>
            </div>
          </form>
          {error ? (
            <p className="mt-3 text-sm text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
          {okMsg ? (
            <p className="mt-3 text-sm text-emerald-700" role="status">
              {okMsg}
            </p>
          ) : null}
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-[#EBE6E0] bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)]">
          <div className="border-b border-[#EFEAE4] px-5 py-4">
            <p className="text-base text-[#1A1A1A]">Affiliates</p>
            <p className="mt-1 text-sm text-[#7A746C]">
              Revenue is attributed order subtotals; commission owed is what you
              owe each affiliate.
            </p>
          </div>
          {loadingList ? (
            <p className="px-5 py-8 text-sm text-[#7A746C]">Loading…</p>
          ) : listError ? (
            <p className="px-5 py-8 text-sm text-rose-700" role="alert">
              {listError}
            </p>
          ) : affiliates.length === 0 ? (
            <p className="px-5 py-8 text-sm text-[#7A746C]">No accounts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="bg-[#FBF9F7] text-[#7A746C]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Affiliate</th>
                    <th className="px-5 py-3 font-medium">Orders</th>
                    <th className="px-5 py-3 font-medium">Revenue</th>
                    <th className="px-5 py-3 font-medium">Commission owed</th>
                    <th className="px-5 py-3 font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {affiliates.map((a) => (
                    <tr key={a.id} className="border-t border-[#EFEAE4]">
                      <td className="px-5 py-4 align-top">
                        <p className="font-medium text-[#1A1A1A]">
                          {a.displayName}
                          {!a.active ? (
                            <span className="ml-2 text-xs font-normal text-[#8A8580]">
                              (disabled)
                            </span>
                          ) : null}
                          {a.role === "admin" ? (
                            <span className="ml-2 text-xs font-normal text-[#8B4A4A]">
                              admin
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-[#7A746C]">
                          {a.discountCode} ({formatAffiliateDiscount(a)}) ·{" "}
                          {a.earningsPercent}% commission
                        </p>
                      </td>
                      <td className="px-5 py-4 tabular-nums align-top">
                        {formatInt(a.orders)}
                      </td>
                      <td className="px-5 py-4 font-medium tabular-nums align-top">
                        {formatGbp(a.revenue)}
                      </td>
                      <td className="px-5 py-4 font-medium tabular-nums align-top text-[#8B4A4A]">
                        {formatGbp(a.commissionOwed)}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <button
                          type="button"
                          disabled={a.id === account.id || !a.active}
                          onClick={() => {
                            void (async () => {
                              const result = await deleteAffiliateAccount(a.id);
                              if (!result.ok) {
                                setListError(result.error);
                                return;
                              }
                              await refresh();
                            })();
                          }}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E4DED6] px-3 py-2 text-sm text-[#8B4A4A] hover:bg-[#FDF6F6] disabled:opacity-40"
                        >
                          <Trash className="h-4 w-4" />
                          Disable
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
