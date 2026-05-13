"use client";

import { useRouter } from "next/navigation";
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
  /** When true, a small badge is shown beside the link (entire Shopify order in this return). */
  fullOrderRefund?: boolean;
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
  fullOrderRefund,
  children,
}: ShopifyRefundAuditButtonProps) {
  const router = useRouter();

  function patchMarkRefundedInBackground() {
    const uid = returnLogId?.trim();
    if (!uid) return;
    void fetch(`/api/returns/log/${encodeURIComponent(uid)}`, {
      method: "PATCH",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markRefunded: true }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
        if (res.ok && data.ok) router.refresh();
      })
      .catch(() => {});
  }

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

  const wrapClass =
    "inline-flex w-full min-w-0 flex-wrap items-center justify-center gap-2";

  const fullOrderBadge =
    fullOrderRefund === true ? (
      <span
        className="shrink-0 rounded-full border border-amber-300/90 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950 shadow-sm dark:border-amber-700/80 dark:bg-amber-950/60 dark:text-amber-100"
        title="This return includes every line item on the Shopify order at full quantity"
      >
        Full order
      </span>
    ) : null;

  if (disabled) {
    return (
      <span className={wrapClass}>
        <span
          className={className}
          title={title}
          aria-disabled="true"
        >
          {children}
        </span>
        {fullOrderBadge}
      </span>
    );
  }

  return (
    <span className={wrapClass}>
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
          patchMarkRefundedInBackground();
        }}
      >
        {children}
      </a>
      {fullOrderBadge}
    </span>
  );
}
