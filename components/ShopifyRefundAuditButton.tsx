"use client";

import { useState } from "react";
import { toast } from "sonner";

export type ShopifyRefundAuditButtonProps = {
  href: string;
  orderRef: string;
  returnLogId?: string | null;
  refundAmountGbp: number | null;
  currency?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  /** REST order id as digits string when known. */
  shopifyOrderId?: string | null;
  notes?: string | null;
  className?: string;
  title?: string;
  disabled?: boolean;
  children: React.ReactNode;
};

/**
 * Opens Shopify Admin refund in a new tab **synchronously** on click (same as a
 * plain `<a target="_blank" href={href}>` — avoids popup blockers and blank tabs).
 * Then POSTs the internal audit log; if that fails, the tab is already correct — we
 * only toast so staff know the audit row was not saved.
 */
export function ShopifyRefundAuditButton({
  href,
  orderRef,
  returnLogId,
  refundAmountGbp,
  currency,
  customerName,
  customerEmail,
  shopifyOrderId,
  notes,
  className,
  title,
  disabled,
  children,
}: ShopifyRefundAuditButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (disabled || busy) return;
    setBusy(true);
    // Same navigation as before: direct open in the click stack (no `await` before this).
    const tab = window.open(href, "_blank");
    if (!tab) {
      setBusy(false);
      toast.error(
        "Popup blocked — allow popups for this site to open Shopify Admin.",
      );
      return;
    }
    try {
      const res = await fetch("/api/returns/refund-audit", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderRef,
          returnLogId,
          refundAmount: refundAmountGbp,
          currency: currency ?? "GBP",
          customerName,
          customerEmail,
          shopifyOrderId: shopifyOrderId?.trim() || null,
          notes,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        toast.error(
          data.error ??
            `Could not save refund audit (${res.status}). Shopify still opened in the other tab.`,
        );
      }
    } catch {
      toast.error(
        "Could not save refund audit. Shopify still opened in the other tab.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (disabled) {
    return (
      <span
        className={className}
        title={title}
        aria-disabled="true"
      >
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      title={title}
      disabled={busy}
      onClick={() => void handleClick()}
    >
      {busy ? "…" : children}
    </button>
  );
}
