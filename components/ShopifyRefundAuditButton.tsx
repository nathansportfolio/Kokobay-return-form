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

type RefundAuditResponse = {
  ok?: boolean;
  error?: string;
};

/**
 * Opens Shopify Admin **refund** in a new tab (same as a plain link), then POSTs
 * `/api/returns/refund-audit` to append **`refundAuditLogs`** only. Refund status in
 * the list still comes from live Shopify reads elsewhere — this is staff intent /
 * analytics, not money movement via our API.
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
    console.log("[refund] button clicked", { orderRef, shopifyOrderId });

    const tab = window.open(href, "_blank");
    if (!tab) {
      toast.error(
        "Popup blocked — allow popups for this site to open Shopify Admin.",
      );
      return;
    }

    setBusy(true);
    try {
      console.log("[refund] POST /api/returns/refund-audit (after opening Shopify)");
      const res = await fetch("/api/returns/refund-audit", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
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
      const data = (await res.json().catch(() => ({}))) as RefundAuditResponse;
      console.log("[refund] audit response", { status: res.status, ok: data.ok });

      if (!res.ok || !data.ok) {
        console.error("[refund] audit failed", data.error, res.status);
        toast.error(
          data.error ??
            `Could not save audit log (${res.status}). Shopify still opened in the other tab.`,
        );
        return;
      }

      console.log("[refund] complete");
      toast.success("Shopify opened · refund audit saved");
    } catch (e) {
      console.error("[refund] fetch threw", e);
      toast.error(
        "Could not save audit log. Shopify still opened in the other tab.",
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
      title={
        title ??
        "Open Shopify Admin refund (new tab), then save an internal audit row in Mongo"
      }
      disabled={busy}
      onClick={() => void handleClick()}
    >
      {busy ? "…" : children}
    </button>
  );
}
