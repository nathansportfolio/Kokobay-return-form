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
  adminOrderUrl?: string;
  shopifyRefundId?: number;
};

/**
 * POSTs to `/api/returns/refund-audit`: server runs Shopify **calculate → refund
 * create**, then inserts **`refundAuditLogs`**. Opens Admin order URL on success
 * (or when refund succeeded but audit failed, if `adminOrderUrl` is returned).
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
    setBusy(true);
    try {
      console.log("[refund] starting Shopify refund (POST /api/returns/refund-audit)");
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
      console.log("[refund] POST /api/returns/refund-audit response", {
        status: res.status,
        ok: data.ok,
        shopifyRefundId: data.shopifyRefundId,
      });

      const openUrl = data.adminOrderUrl ?? (res.ok ? href : undefined);
      if (openUrl) {
        console.log("[refund] opening Admin", openUrl);
        window.open(openUrl, "_blank", "noopener,noreferrer");
      }

      if (!res.ok || !data.ok) {
        console.error("[refund] refund flow failed", data.error, res.status);
        toast.error(
          data.error ??
            `Refund request failed (${res.status}). Check server logs and Mongo.`,
        );
        return;
      }

      console.log("[refund] complete");
      toast.success("Refund processed in Shopify", {
        description: data.shopifyRefundId
          ? `Refund #${data.shopifyRefundId} · audit logged`
          : "Audit logged",
      });
    } catch (e) {
      console.error("[refund] fetch threw", e);
      toast.error("Network error calling refund API");
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
        "Creates refund in Shopify (API), logs audit, opens order in Admin (new tab)"
      }
      disabled={busy}
      onClick={() => void handleClick()}
    >
      {busy ? "…" : children}
    </button>
  );
}
