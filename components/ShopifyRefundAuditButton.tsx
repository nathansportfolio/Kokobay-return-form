"use client";

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
 * Native **link** to Shopify Admin refund (`href`) — same as `<a target="_blank">`,
 * so the browser opens the app reliably (no `window.open` / popup timing issues).
 * Fires `/api/returns/refund-audit` in the background for **`refundAuditLogs`** (does
 * not block navigation).
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
  function postAuditInBackground() {
    void fetch("/api/returns/refund-audit", {
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
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as RefundAuditResponse;
        console.log("[refund] audit response", { status: res.status, ok: data.ok });
        if (!res.ok || !data.ok) {
          console.error("[refund] audit failed", data.error, res.status);
          toast.error(
            data.error ??
              `Could not save audit log (${res.status}). Shopify still opened in the other tab.`,
          );
        } else {
          console.log("[refund] complete");
          toast.success("Refund audit saved");
        }
      })
      .catch((e) => {
        console.error("[refund] fetch threw", e);
        toast.error(
          "Could not save audit log. If Shopify opened, the refund screen is still available in that tab.",
        );
      });
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
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title={
        title ??
        "Open Shopify Admin refund in a new tab (same as a normal link); saves an internal audit row"
      }
      onClick={() => {
        console.log("[refund] link clicked (native open)", { orderRef, shopifyOrderId });
        postAuditInBackground();
      }}
    >
      {children}
    </a>
  );
}
