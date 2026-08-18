"use client";

import { useCallback, useEffect, useState } from "react";
import { CaretDown, Check, Copy, Key, Plus, Printer, Trash } from "@phosphor-icons/react";
import {
  createAffiliateAccount,
  deleteAffiliateAccount,
  fetchAffiliateAdminOverview,
  fetchAffiliateInvoicesForAdmin,
  formatAffiliateDiscount,
  formatGbp,
  formatInt,
  openAffiliateInvoicePdf,
  printAffiliateInvoice,
  recordAffiliatePayout,
  updateAffiliateAccountPin,
} from "@/lib/affiliate/api";
import type {
  AffiliateAccount,
  AffiliateAdminOverview,
  AffiliateAdminOverviewRow,
  AffiliateDiscountType,
  AffiliateInvoiceRow,
  AffiliatePayoutPeriod,
} from "@/lib/affiliate/types";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-[#E4DED6] bg-[#FBF9F7] px-3.5 py-2.5 text-sm outline-none focus:border-[#E89292] focus:ring-2 focus:ring-[#E89292]/30";

const STOREFRONT_BASE = "https://kokobay.co.uk";

/** Customer-facing percentage discount hard cap. */
const MAX_DISCOUNT_PERCENT = 30;
/** Affiliate commission hard cap. */
const MAX_EARNINGS_PERCENT = 40;

function affiliateShareUrl(discountCode: string): string {
  const code = discountCode.trim().toUpperCase();
  return `${STOREFRONT_BASE}?ref=${encodeURIComponent(code)}`;
}

function formatPaidAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function payoutDetailsReady(
  details: AffiliateAdminOverviewRow["payoutDetails"],
): boolean {
  if (!details) return false;
  return Boolean(
    details.legalName?.trim() &&
      details.addressLine1?.trim() &&
      details.city?.trim() &&
      details.postcode?.trim() &&
      details.accountName?.trim() &&
      details.sortCode?.trim() &&
      details.accountNumber?.trim(),
  );
}

function paysAfterLabel(period: AffiliatePayoutPeriod | null | undefined): string {
  if (!period?.paysAfter) return "";
  const d = new Date(period.paysAfter);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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

function CopyField({ label, value }: { label: string; value: string }) {
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
    </div>
  );
}

function PayAffiliateModal({
  affiliate,
  onClose,
  onPaid,
}: {
  affiliate: AffiliateAdminOverviewRow;
  onClose: () => void;
  onPaid: () => Promise<void>;
}) {
  const [amount, setAmount] = useState(
    affiliate.commissionOwed > 0 ? String(affiliate.commissionOwed) : "",
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-affiliate-title"
        className="w-full max-w-md rounded-2xl border border-[#EBE6E0] bg-white p-5 shadow-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="pay-affiliate-title" className="text-base text-[#1A1A1A]">
          Pay {affiliate.displayName}
        </p>
        <p className="mt-1 text-sm text-[#7A746C]">
          Unpaid balance {formatGbp(affiliate.commissionOwed)}. Record what you
          actually paid — this is timestamped in Mongo.
        </p>

        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              setError(null);
              const value = Number.parseFloat(amount);
              if (!Number.isFinite(value) || value <= 0) {
                setError("Enter an amount greater than zero.");
                return;
              }
              setBusy(true);
              const result = await recordAffiliatePayout({
                affiliateId: affiliate.id,
                amount: value,
                note: note.trim() || undefined,
              });
              setBusy(false);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              await onPaid();
              onClose();
            })();
          }}
        >
          <div>
            <label htmlFor="pay-amount" className="text-sm font-medium">
              Amount paid (£)
            </label>
            <input
              id="pay-amount"
              type="number"
              min={0.01}
              step={0.01}
              required
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
              placeholder="0.00"
            />
          </div>
          <div>
            <label htmlFor="pay-note" className="text-sm font-medium">
              Note (optional)
            </label>
            <input
              id="pay-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
              placeholder="Bank transfer, PayPal…"
              maxLength={200}
            />
          </div>
          {error ? (
            <p className="text-sm text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-[#E4DED6] bg-white px-4 py-2.5 text-sm text-[#3D3A36] hover:bg-[#FBF9F7] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-[#1A1A1A] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Record payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChangePinModal({
  affiliate,
  onClose,
}: {
  affiliate: AffiliateAdminOverviewRow;
  onClose: () => void;
}) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-pin-title"
        className="w-full max-w-md rounded-2xl border border-[#EBE6E0] bg-white p-5 shadow-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="change-pin-title" className="text-base text-[#1A1A1A]">
          Change PIN for {affiliate.displayName}
        </p>
        <p className="mt-1 text-sm text-[#7A746C]">
          Login code {affiliate.code}. The new PIN replaces their current one
          immediately.
        </p>

        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              setError(null);
              setOkMsg(null);
              if (!/^\d{4,8}$/.test(pin)) {
                setError("PIN must be 4–8 digits.");
                return;
              }
              if (pin !== confirmPin) {
                setError("PINs do not match.");
                return;
              }
              setBusy(true);
              const result = await updateAffiliateAccountPin(affiliate.id, pin);
              setBusy(false);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setOkMsg("PIN updated.");
              window.setTimeout(() => onClose(), 700);
            })();
          }}
        >
          <div>
            <label htmlFor="new-pin" className="text-sm font-medium">
              New PIN (4–8 digits)
            </label>
            <input
              id="new-pin"
              inputMode="numeric"
              maxLength={8}
              autoFocus
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
              className={`${inputClass} tracking-[0.3em]`}
              placeholder="1234"
            />
          </div>
          <div>
            <label htmlFor="confirm-pin" className="text-sm font-medium">
              Confirm PIN
            </label>
            <input
              id="confirm-pin"
              inputMode="numeric"
              maxLength={8}
              value={confirmPin}
              onChange={(e) =>
                setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
              className={`${inputClass} tracking-[0.3em]`}
              placeholder="1234"
            />
          </div>
          {error ? (
            <p className="text-sm text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
          {okMsg ? (
            <p className="text-sm text-emerald-700" role="status">
              {okMsg}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-[#E4DED6] bg-white px-4 py-2.5 text-sm text-[#3D3A36] hover:bg-[#FBF9F7] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-[#1A1A1A] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Update PIN"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AffiliateAccordionRow({
  affiliate: a,
  period,
  selfId,
  onDisable,
  onPay,
  onChangePin,
}: {
  affiliate: AffiliateAdminOverviewRow;
  period: AffiliatePayoutPeriod | null | undefined;
  selfId: string;
  onDisable: (id: string) => Promise<void>;
  onPay: (affiliate: AffiliateAdminOverviewRow) => void;
  onChangePin: (affiliate: AffiliateAdminOverviewRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<AffiliateInvoiceRow[] | null>(null);
  const shareUrl = affiliateShareUrl(a.discountCode);
  const dueHint = period?.isOpen
    ? `This cycle · due after ${paysAfterLabel(period)}`
    : "Due now";
  const canPrint =
    a.role === "affiliate" &&
    a.active &&
    a.commissionOwed > 0 &&
    payoutDetailsReady(a.payoutDetails);

  useEffect(() => {
    if (!open || a.role !== "affiliate") return;
    void (async () => {
      const result = await fetchAffiliateInvoicesForAdmin(a.id);
      if (result.ok) setInvoices(result.invoices);
    })();
  }, [open, a.id, a.role]);

  return (
    <div className="border-t border-[#EFEAE4]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-[#FBF9F7]/80"
      >
        <CaretDown
          className={`mt-1 h-4 w-4 shrink-0 text-[#8A8580] transition-transform ${
            open ? "rotate-0" : "-rotate-90"
          }`}
          weight="bold"
        />
        <div className="min-w-0 flex-1">
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
            {formatAffiliateDiscount(a)} off · {a.earningsPercent}% commission
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-5">
            <div>
              <dt className="text-xs text-[#8A8580]">Clicks</dt>
              <dd className="mt-0.5 tabular-nums text-[#1A1A1A]">
                {formatInt(a.clicks ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#8A8580]">Orders</dt>
              <dd className="mt-0.5 tabular-nums text-[#1A1A1A]">
                {formatInt(a.orders)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#8A8580]">Revenue</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-[#1A1A1A]">
                {formatGbp(a.revenue ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#8A8580]">This cycle</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-[#1A1A1A]">
                {formatGbp(a.periodEarnings ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#8A8580]">Unpaid</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-[#8B4A4A]">
                {formatGbp(a.commissionOwed)}
              </dd>
            </div>
          </dl>
        </div>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-[#F3EEE8] bg-[#FBF9F7]/60 px-5 py-4 sm:pl-12">
          <CopyField label="Discount code" value={a.discountCode} />
          <CopyField label="Share link" value={shareUrl} />
          {a.role === "affiliate" ? (
            <div className="rounded-xl border border-[#E4DED6] bg-white px-3.5 py-3 text-sm">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8A8580]">
                Payouts
              </p>
              <p className="mt-1.5 text-[#3D3A36]">
                Unpaid {formatGbp(a.commissionOwed)}
                <span className="text-[#8A8580]"> · {dueHint}</span>
              </p>
              <p className="mt-1 text-xs text-[#8A8580]">
                Last paid{" "}
                {a.lastPaidAt
                  ? `${formatGbp(a.lastPaidAmount ?? 0)} on ${formatPaidAt(a.lastPaidAt)}`
                  : "—"}
                {a.lifetimePaid && a.lifetimePaid > 0
                  ? ` · Total paid ${formatGbp(a.lifetimePaid)}`
                  : ""}
              </p>
              {a.payoutDetails && payoutDetailsReady(a.payoutDetails) ? (
                <dl className="mt-3 grid gap-1 text-xs text-[#7A746C]">
                  <div>
                    {a.payoutDetails.legalName} · {a.payoutDetails.city}{" "}
                    {a.payoutDetails.postcode}
                  </div>
                  <div>
                    {a.payoutDetails.accountName} · {a.payoutDetails.sortCode} ·{" "}
                    {a.payoutDetails.accountNumber}
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-xs text-[#8B4A4A]">
                  No address/bank details on file yet — they need to add these
                  in Profile before you can print an invoice.
                </p>
              )}
            </div>
          ) : null}
          {a.role === "affiliate" && invoices && invoices.length > 0 ? (
            <div className="rounded-xl border border-[#E4DED6] bg-white px-3.5 py-3 text-sm">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8A8580]">
                Invoices
              </p>
              <ul className="mt-2 space-y-2">
                {invoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0 truncate text-[#3D3A36]">
                      {inv.invoiceNumber} · {formatGbp(inv.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void (async () => {
                          const result = await openAffiliateInvoicePdf(inv.id);
                          if (!result.ok) setActionError(result.error);
                        })();
                      }}
                      className="shrink-0 rounded-lg border border-[#E4DED6] bg-white px-2.5 py-1 text-xs text-[#3D3A36] hover:bg-[#FBF9F7]"
                    >
                      View PDF
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {actionError ? (
            <p className="text-sm text-rose-700" role="alert">
              {actionError}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            {a.role === "affiliate" && a.active ? (
              <>
                <button
                  type="button"
                  onClick={() => onChangePin(a)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E4DED6] bg-white px-3.5 py-2 text-sm font-medium text-[#3D3A36] hover:bg-[#FBF9F7]"
                >
                  <Key className="h-4 w-4" />
                  Change PIN
                </button>
                <button
                  type="button"
                  disabled={!canPrint || printing}
                  onClick={() => {
                    void (async () => {
                      setActionError(null);
                      setPrinting(true);
                      const result = await printAffiliateInvoice(a.id);
                      setPrinting(false);
                      if (!result.ok) {
                        setActionError(result.error);
                        return;
                      }
                      const listed = await fetchAffiliateInvoicesForAdmin(a.id);
                      if (listed.ok) setInvoices(listed.invoices);
                    })();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E4DED6] bg-white px-3.5 py-2 text-sm font-medium text-[#3D3A36] hover:bg-[#FBF9F7] disabled:opacity-40"
                >
                  <Printer className="h-4 w-4" />
                  {printing ? "Preparing…" : "Print invoice"}
                </button>
                <button
                  type="button"
                  onClick={() => onPay(a)}
                  className="inline-flex items-center justify-center rounded-xl bg-[#1A1A1A] px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Pay affiliate
                </button>
              </>
            ) : null}
            <button
              type="button"
              disabled={a.id === selfId || !a.active || disabling}
              onClick={() => {
                void (async () => {
                  setDisabling(true);
                  try {
                    await onDisable(a.id);
                  } finally {
                    setDisabling(false);
                  }
                })();
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E4DED6] bg-white px-3 py-2 text-sm text-[#8B4A4A] hover:bg-[#FDF6F6] disabled:opacity-40"
            >
              <Trash className="h-4 w-4" />
              Disable
            </button>
          </div>
        </div>
      ) : null}
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
  const [payTarget, setPayTarget] = useState<AffiliateAdminOverviewRow | null>(
    null,
  );
  const [pinTarget, setPinTarget] = useState<AffiliateAdminOverviewRow | null>(
    null,
  );

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
  const period = overview?.period;

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
        {period ? (
          <p className="mb-4 text-sm text-[#7A746C]">
            Payout cycle{" "}
            <span className="font-medium text-[#3D3A36]">{period.label}</span>
            {period.isOpen
              ? ` · accrues until ${paysAfterLabel(period)} (UK midnight)`
              : " · period closed — pay unpaid balances"}
          </p>
        ) : null}

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
                label="Unpaid commission"
                value={formatGbp(overview?.totals?.commissionOwed ?? 0)}
                hint={
                  period
                    ? `This cycle ${formatGbp(overview?.totals?.periodEarnings ?? 0)} · paid ${formatGbp(overview?.totals?.lifetimePaid ?? 0)}`
                    : "Earnings minus recorded payouts"
                }
              />
              <OverviewStat
                label="Net after unpaid"
                value={formatGbp(overview?.totals?.netRevenue ?? 0)}
                hint="Revenue minus unpaid commission"
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
              Expand an affiliate to copy their link or record a payout. Unpaid
              is earnings since 30 Jul 2026 minus what you&apos;ve marked as
              paid.
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
            <div>
              {affiliates.map((a) => (
                <AffiliateAccordionRow
                  key={a.id}
                  affiliate={a}
                  period={period}
                  selfId={account.id}
                  onPay={setPayTarget}
                  onChangePin={setPinTarget}
                  onDisable={async (id) => {
                    const result = await deleteAffiliateAccount(id);
                    if (!result.ok) {
                      setListError(result.error);
                      return;
                    }
                    await refresh();
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {payTarget ? (
        <PayAffiliateModal
          affiliate={payTarget}
          onClose={() => setPayTarget(null)}
          onPaid={refresh}
        />
      ) : null}
      {pinTarget ? (
        <ChangePinModal
          affiliate={pinTarget}
          onClose={() => setPinTarget(null)}
        />
      ) : null}
    </div>
  );
}
