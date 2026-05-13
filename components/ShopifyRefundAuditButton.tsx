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
 * Records an internal Mongo audit row, then opens the Shopify Admin refund URL.
 * Does not call Shopify APIs — success is our POST succeeding.
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
        toast.error(data.error ?? `Could not log refund (${res.status})`);
        return;
      }
      window.open(href, "_blank", "noopener,noreferrer");
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
