"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { KokobayOrderLine } from "@/lib/kokobayOrderLines";
import { formatGbp } from "@/lib/kokobayOrderLines";
import { womensFashionPlaceholderForReturnLine } from "@/lib/picklistPlaceholderImages";
import {
  CUSTOMER_FORM_REASON_SELECT_OPTIONS,
  CUSTOMER_FORM_REASON_UNSET,
} from "@/lib/customerReturnFormReasons";
import { mapCustomerFormReasonToWarehouse } from "@/lib/customerFormToWarehouseReturn";
import { reasonValueForSharedReturnSelect } from "@/lib/returnReasonForSelect";
import { buildKlaviyoReturnItemFromLineTitleAndReason } from "@/lib/klaviyoReturnItemFromOrderLine";
import { lineSkuForWarehouseUi } from "@/lib/returnLineSkuDisplay";
import {
  normalizeReturnLineDisposition,
  type ReturnLineDisposition,
  type ReturnPageResume,
} from "@/lib/returnLogTypes";
import {
  dispositionCountsTowardCustomerRefund,
  sumRefundableTotalSelectedLinesGbp,
} from "@/lib/returnRefundDisposition";
import {
  MAX_RETURN_LINE_NOTES,
  clampReturnLineNotes,
} from "@/lib/returnLineNotes";
import { RETURN_LINE_DISPOSITION_SELECTED_TONE } from "@/lib/returnLineDispositionUi";
import {
  shopifyOrderAdminUrlByOrderId,
  shopifyOrderAdminUrlFromOrderRef,
} from "@/lib/shopifyOrderAdminUrl";
import {
  CurrencyGbp,
  EnvelopeSimple,
  Plus,
  Prohibit,
  Storefront,
} from "@phosphor-icons/react";
import { toast } from "sonner";

async function postKlaviyoReturnReceived(input: {
  email: string;
  firstName: string;
  orderId: string;
  refundAmount: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/klaviyo/return-received", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    detail?: string;
  };
  if (!res.ok || !data.ok) {
    const base = data.error ?? `Klaviyo request failed (${res.status})`;
    const detail =
      typeof data.detail === "string" && data.detail.trim()
        ? ` ${data.detail.trim()}`
        : "";
    return { ok: false, error: `${base}${detail}` };
  }
  console.log("[returns] Klaviyo Return Received sent OK", {
    orderId: input.orderId,
    refundAmount: input.refundAmount,
    firstName: input.firstName,
    httpStatus: res.status,
  });
  return { ok: true };
}

async function postKlaviyoReturnRejected(input: {
  email: string;
  firstName: string;
  orderId: string;
  items: { name: string; size: string; reason: string }[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/klaviyo/return-rejected", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    detail?: string;
  };
  if (!res.ok || !data.ok) {
    const base = data.error ?? `Klaviyo request failed (${res.status})`;
    const detail =
      typeof data.detail === "string" && data.detail.trim()
        ? ` ${data.detail.trim()}`
        : "";
    return { ok: false, error: `${base}${detail}` };
  }
  console.log(
    `[returns] return-rejected sent OK http=${res.status} orderId=${input.orderId} items=${input.items.length}`,
  );
  console.log("[returns] return-rejected sent OK detail", {
    orderId: input.orderId,
    firstName: input.firstName,
    itemCount: input.items.length,
    returnItems: input.items,
    httpStatus: res.status,
  });
  return { ok: true };
}

const WAREHOUSE_HANDLING_OPTIONS: ReadonlyArray<{
  value: ReturnLineDisposition;
  label: string;
}> = [
  { value: "restock", label: "On shelf / to be reshelved" },
  { value: "dispose", label: "Dispose & refund" },
  { value: "return_to_sender", label: "Return to sender" },
  { value: "wrong_item_received", label: "Wrong item received" },
];

function dispositionRadioSurface(
  value: ReturnLineDisposition,
  current: ReturnLineDisposition,
): string {
  const base =
    "flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors";
  const inactive =
    "border-zinc-200 bg-white text-foreground dark:border-zinc-700";
  if (current !== value) return `${base} ${inactive}`;
  return `${base} ${RETURN_LINE_DISPOSITION_SELECTED_TONE[value]}`;
}

type LineState = {
  selected: boolean;
  reason: string;
  disposition: ReturnLineDisposition;
  notes: string;
  /** When true, line is included in “rejected items” Klaviyo email (must also be selected). */
  rejectNotifyCustomer: boolean;
};

function emptyLine(): LineState {
  return {
    selected: false,
    reason: CUSTOMER_FORM_REASON_UNSET,
    disposition: "restock",
    notes: "",
    rejectNotifyCustomer: false,
  };
}

function safeDomId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 72);
}

function initialState(lines: KokobayOrderLine[]): Record<string, LineState> {
  return Object.fromEntries(
    lines.map((line) => [line.id, emptyLine()]),
  );
}

function buildInitialState(
  lines: KokobayOrderLine[],
  resume: ReturnPageResume | null,
): Record<string, LineState> {
  if (!resume) {
    return initialState(lines);
  }
  return Object.fromEntries(
    lines.map((line) => {
      const r = resume.byLine[line.id];
      if (r) {
        return [
          line.id,
          {
            selected: true,
            reason: reasonValueForSharedReturnSelect(r.reason),
            disposition: normalizeReturnLineDisposition(r.disposition),
            notes: r.notes?.trim() ?? "",
            rejectNotifyCustomer: false,
          } satisfies LineState,
        ];
      }
      return [line.id, emptyLine()];
    }),
  );
}

function orderTotal(lines: KokobayOrderLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}

function ReturnLineThumbnail({
  line,
}: {
  line: Pick<KokobayOrderLine, "id" | "sku" | "title" | "imageUrl">;
}) {
  const placeholder = useMemo(
    () =>
      womensFashionPlaceholderForReturnLine({
        lineId: line.id,
        sku: line.sku,
      }),
    [line.id, line.sku],
  );
  const primary = line.imageUrl?.trim();
  const [src, setSrc] = useState(() => primary || placeholder);
  useEffect(() => {
    setSrc(primary || placeholder);
  }, [line.id, line.imageUrl, primary, placeholder]);

  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
      <img
        src={src}
        alt=""
        width={80}
        height={80}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        onError={() => {
          setSrc((s) => (s === placeholder ? s : placeholder));
        }}
      />
    </div>
  );
}

export function OrderReturnLines({
  orderLabel,
  shopifyOrderId,
  lines,
  resume = null,
  notifyCustomer = null,
  currentOperatorLabel = null,
}: {
  /** From Shopify `order.name` (e.g. #1001) when known. */
  orderLabel: string;
  /**
   * REST `order.id` for admin order URLs. Prefer this over the label so links
   * open the correct order in all cases.
   */
  shopifyOrderId?: string;
  lines: KokobayOrderLine[];
  /** When present, pre-fill from the last return log for this order. */
  resume?: ReturnPageResume | null;
  /**
   * When set, “Log & notify customer” and “Email Customer Items Received” send
   * Klaviyo “Return Received” before marking the email step complete.
   */
  notifyCustomer?: { email: string; firstName: string } | null;
  /** Warehouse person from login PIN (`warehouse_operator` cookie). */
  currentOperatorLabel?: string | null;
}) {
  const router = useRouter();
  const [byId, setById] = useState(() => buildInitialState(lines, resume));
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [returnUid, setReturnUid] = useState<string | null>(
    () => resume?.returnUid ?? null,
  );
  const [regEmail, setRegEmail] = useState(
    () => resume?.customerEmailSent ?? false,
  );
  const [regRefund, setRegRefund] = useState(
    () => resume?.fullRefundIssued ?? false,
  );
  const [saving, setSaving] = useState(false);
  const [returnBusy, setReturnBusy] = useState(false);
  const [notesOpenByLine, setNotesOpenByLine] = useState<Record<string, boolean>>(
    {},
  );
  const masterCheckboxRef = useRef<HTMLInputElement>(null);

  const lineKey = useMemo(() => lines.map((l) => l.id).join("\0"), [lines]);

  useEffect(() => {
    setById((prev) => {
      const next = { ...prev };
      for (const line of lines) {
        if (!(line.id in next)) next[line.id] = emptyLine();
      }
      return next;
    });
  }, [lineKey, lines]);

  const updateLine = useCallback((id: string, patch: Partial<LineState>) => {
    setById((prev) => ({
      ...prev,
      [id]: { ...emptyLine(), ...prev[id], ...patch },
    }));
  }, []);

  const setLineSelected = useCallback((id: string, selected: boolean) => {
    if (!selected) {
      setNotesOpenByLine((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    }
    setById((prev) => {
      const base = { ...emptyLine(), ...prev[id] };
      return {
        ...prev,
        [id]: {
          ...base,
          selected,
          ...(selected
            ? {}
            : {
                reason: CUSTOMER_FORM_REASON_UNSET,
                disposition: "restock" as const,
                notes: "",
                rejectNotifyCustomer: false,
              }),
        },
      };
    });
  }, []);

  const selectedCount = useMemo(
    () => lines.filter((l) => Boolean(byId[l.id]?.selected)).length,
    [byId, lines],
  );

  const selectedRefund = useMemo(
    () => sumRefundableTotalSelectedLinesGbp(lines, byId),
    [byId, lines],
  );

  /**
   * Reject → Klaviyo (“Return Submitted”) UI is hidden until at least one selected
   * line uses Return to sender (warehouse asked to surface it that way).
   */
  const showRejectCustomerKlaviyoUi = useMemo(
    () =>
      lines.some((l) => {
        const s = byId[l.id];
        return (
          Boolean(s?.selected) &&
          normalizeReturnLineDisposition(s.disposition) === "return_to_sender"
        );
      }),
    [byId, lines],
  );

  const rejectedNotifyReadyCount = useMemo(() => {
    if (!showRejectCustomerKlaviyoUi) return 0;
    return lines.filter((l) => {
      const s = byId[l.id];
      if (!s?.selected || !s.rejectNotifyCustomer) return false;
      if (
        !dispositionCountsTowardCustomerRefund(
          normalizeReturnLineDisposition(s.disposition),
        )
      ) {
        return false;
      }
      return clampReturnLineNotes(s.notes ?? "").trim().length > 0;
    }).length;
  }, [showRejectCustomerKlaviyoUi, byId, lines]);

  useEffect(() => {
    if (showRejectCustomerKlaviyoUi) return;
    setById((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const line of lines) {
        const row = { ...emptyLine(), ...next[line.id] };
        if (row.rejectNotifyCustomer) {
          next[line.id] = { ...row, rejectNotifyCustomer: false };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [showRejectCustomerKlaviyoUi, lineKey]);

  const allReturned =
    lines.length > 0 && lines.every((l) => byId[l.id]?.selected);
  const someReturned = lines.some((l) => byId[l.id]?.selected);
  const fullOrderTotal = useMemo(() => orderTotal(lines), [lines]);
  const shopifyAdminHref = useMemo(
    () =>
      shopifyOrderId
        ? shopifyOrderAdminUrlByOrderId(shopifyOrderId)
        : shopifyOrderAdminUrlFromOrderRef(orderLabel),
    [orderLabel, shopifyOrderId],
  );

  useEffect(() => {
    const el = masterCheckboxRef.current;
    if (el) el.indeterminate = someReturned && !allReturned;
  }, [someReturned, allReturned]);

  const setEntireOrderReturned = useCallback(
    (selected: boolean) => {
      if (!selected) setNotesOpenByLine({});
      setById((prev) => {
        const next = { ...prev };
        for (const line of lines) {
          const base = { ...emptyLine(), ...next[line.id] };
          next[line.id] = {
            ...base,
            selected,
            ...(selected
              ? {}
              : {
                  reason: CUSTOMER_FORM_REASON_UNSET,
                  disposition: "restock" as const,
                  notes: "",
                  rejectNotifyCustomer: false,
                }),
          };
        }
        return next;
      });
    },
    [lines],
  );

  const applyLogFlags = useCallback(
    (doc: { customerEmailSent: boolean; fullRefundIssued: boolean }) => {
      setRegEmail(!!doc.customerEmailSent);
      setRegRefund(!!doc.fullRefundIssued);
    },
    [],
  );

  const submitLogReturn = useCallback(async () => {
    if (selectedCount === 0) {
      toast.warning("Select at least one line", {
        description: "Tick the checkboxes for items included in this return.",
      });
      return;
    }
    setSaving(true);
    try {
      const body = {
        orderRef: orderLabel,
        ...(shopifyOrderId ? { shopifyOrderId } : {}),
        lines: lines
          .filter((l) => byId[l.id]?.selected)
          .map((l) => {
            const row = { ...emptyLine(), ...byId[l.id] };
            const notesTrimmed = clampReturnLineNotes(row.notes ?? "");
            return {
              lineId: l.id,
              sku: l.sku,
              title: l.title,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              reason:
                row.reason === CUSTOMER_FORM_REASON_UNSET || !row.reason
                  ? null
                  : row.reason,
              disposition: row.disposition,
              ...(notesTrimmed ? { notes: notesTrimmed } : {}),
            };
          }),
      };
      const res = await fetch("/api/returns/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        returnUid?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.returnUid) {
        toast.error(data.error ?? "Could not log return");
        return;
      }
      const newUid = data.returnUid;
      setReturnUid(newUid);

      const refundForNotify = sumRefundableTotalSelectedLinesGbp(lines, byId);
      const refundAmountStr = formatGbp(refundForNotify);

      if (notifyCustomer) {
        const kl = await postKlaviyoReturnReceived({
          email: notifyCustomer.email,
          firstName: notifyCustomer.firstName,
          orderId: orderLabel,
          refundAmount: refundAmountStr,
        });
        if (!kl.ok) {
          toast.error(kl.error, {
            description:
              "Return is saved. Fix Klaviyo or try “Email Customer Items Received”.",
          });
          router.refresh();
          return;
        }
      }

      const patchRes = await fetch(
        `/api/returns/log/${encodeURIComponent(newUid)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markEmailSent: true }),
        },
      );
      const patchData = (await patchRes.json().catch(() => ({}))) as {
        ok?: boolean;
        return?: { customerEmailSent: boolean; fullRefundIssued: boolean };
        error?: string;
      };
      if (!patchRes.ok || !patchData.ok) {
        setRegEmail(false);
        setRegRefund(false);
        router.refresh();
        toast.error(
          patchData.error ?? "Return saved but could not mark email as sent",
          {
            description:
              "The return is logged; you can use “Email Customer Items Received” when it appears, or try again.",
          },
        );
        return;
      }
      if (patchData.return) applyLogFlags(patchData.return);
      else {
        setRegEmail(true);
        setRegRefund(false);
      }
      toast.success("Return registered", {
        description: notifyCustomer
          ? `${selectedCount} line(s) · Klaviyo “Return Received” sent (${refundAmountStr} refund).`
          : `${selectedCount} line(s) · Customer notification step marked complete (no order email on file for Klaviyo).`,
      });
      router.push("/returns");
    } finally {
      setSaving(false);
    }
  }, [
    applyLogFlags,
    byId,
    lines,
    orderLabel,
    router,
    selectedCount,
    shopifyOrderId,
    notifyCustomer,
  ]);

  const sendReceivedEmail = useCallback(async () => {
    if (regEmail) {
      toast.info("customer already emailed");
      return;
    }
    if (!returnUid) {
      toast.error("Log this return first", {
        description: "Use “Log & notify customer” to register, then you can mark email sent.",
      });
      return;
    }
    setReturnBusy(true);
    try {
      let refundAmountStr = "";
      if (notifyCustomer) {
        const refundForNotify = sumRefundableTotalSelectedLinesGbp(lines, byId);
        refundAmountStr = formatGbp(refundForNotify);
        const kl = await postKlaviyoReturnReceived({
          email: notifyCustomer.email,
          firstName: notifyCustomer.firstName,
          orderId: orderLabel,
          refundAmount: refundAmountStr,
        });
        if (!kl.ok) {
          toast.error(kl.error, {
            description: "Fix Klaviyo configuration or try again in a moment.",
          });
          return;
        }
      }

      const res = await fetch(`/api/returns/log/${encodeURIComponent(returnUid)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markEmailSent: true }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        return?: { customerEmailSent: boolean; fullRefundIssued: boolean };
      };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Could not update");
        return;
      }
      if (data.return) applyLogFlags(data.return);
      else setRegEmail(true);
      router.refresh();
      toast.success("Customer email marked as sent", {
        description: notifyCustomer
          ? `Klaviyo “Return Received” sent (${refundAmountStr} refund).`
          : "No automated Klaviyo profile on file for this order.",
      });
    } finally {
      setReturnBusy(false);
    }
  }, [
    applyLogFlags,
    byId,
    lines,
    notifyCustomer,
    orderLabel,
    regEmail,
    returnUid,
    router,
  ]);

  const sendRejectedItemsKlaviyo = useCallback(async () => {
    if (!showRejectCustomerKlaviyoUi) {
      return;
    }
    if (!notifyCustomer) {
      toast.error("No customer email on file", {
        description: "Klaviyo needs an order or form email for this return.",
      });
      return;
    }
    if (rejectedNotifyReadyCount === 0) {
      toast.warning("Select lines to reject", {
        description:
          "Tick a line, add a rejection note under Notes, then enable “Reject — email customer”.",
      });
      return;
    }
    setReturnBusy(true);
    try {
      const rejectedLines = lines.filter((l) => {
        const row = { ...emptyLine(), ...byId[l.id] };
        return (
          row.selected &&
          row.rejectNotifyCustomer &&
          dispositionCountsTowardCustomerRefund(
            normalizeReturnLineDisposition(row.disposition),
          ) &&
          clampReturnLineNotes(row.notes ?? "").trim().length > 0
        );
      });
      const items = rejectedLines.map((l) => {
        const row = { ...emptyLine(), ...byId[l.id] };
        return buildKlaviyoReturnItemFromLineTitleAndReason(
          l.title,
          row.reason === CUSTOMER_FORM_REASON_UNSET ? null : row.reason,
        );
      });
      const kl = await postKlaviyoReturnRejected({
        email: notifyCustomer.email,
        firstName: notifyCustomer.firstName,
        orderId: orderLabel,
        items,
      });
      if (!kl.ok) {
        toast.error(kl.error);
        return;
      }
      for (const l of rejectedLines) {
        updateLine(l.id, { rejectNotifyCustomer: false });
      }
      router.refresh();
      toast.success("Klaviyo “Return Submitted” sent", {
        description: `${items.length} item(s) · ${orderLabel}`,
      });
    } finally {
      setReturnBusy(false);
    }
  }, [
    byId,
    lines,
    notifyCustomer,
    orderLabel,
    rejectedNotifyReadyCount,
    router,
    showRejectCustomerKlaviyoUi,
    updateLine,
  ]);

  const confirmFullRefund = useCallback(async () => {
    if (!returnUid) {
      toast.error("Log this return first", {
        description: "Use “Log & notify customer” to register, then you can mark the refund.",
      });
      return;
    }
    setReturnBusy(true);
    try {
      const res = await fetch(`/api/returns/log/${encodeURIComponent(returnUid)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markFullRefund: true,
          fullRefundAmountGbp: fullOrderTotal,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        return?: { customerEmailSent: boolean; fullRefundIssued: boolean };
      };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Could not update");
        return;
      }
      if (data.return) applyLogFlags(data.return);
      else setRegRefund(true);
      setRefundModalOpen(false);
      router.refresh();
      toast.success("Refund marked as complete", {
        description: `${formatGbp(fullOrderTotal)} for order ${orderLabel}. Connect payments to process for real.`,
      });
    } finally {
      setReturnBusy(false);
    }
  }, [applyLogFlags, fullOrderTotal, orderLabel, returnUid, router]);

  useEffect(() => {
    if (!refundModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRefundModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [refundModalOpen]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Women&apos;s wear · KOKObay
          </p>
          <p className="font-mono text-lg font-semibold text-foreground">
            {orderLabel}
          </p>
          {currentOperatorLabel?.trim() ? (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Signed in as{" "}
              <span className="font-medium text-foreground">
                {currentOperatorLabel.trim()}
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <Link
            href="/returns/logged"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-foreground hover:underline dark:text-zinc-400"
          >
            Logged Returns
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
            |
          </span>
          <Link
            href="/returns"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-foreground hover:underline dark:text-zinc-400"
          >
            Different order
          </Link>
        </div>
      </div>

      {resume ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {resume.source === "customerForm" ? (
            <>
              Lines, quantities, and any reasons from the customer&apos;s online
              return form are pre-filled. Review when goods arrive and correct if
              needed.
            </>
          ) : (
            <>Pre-filled from the last warehouse return for this order.</>
          )}
        </p>
      ) : null}

      {returnUid ? (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/30"
          role="status"
        >
          <p className="font-medium text-emerald-900 dark:text-emerald-200">
            This return is registered
            {(() => {
              const fromLog =
                resume?.source === "returnLog" && resume.loggedByOperator?.trim()
                  ? resume.loggedByOperator.trim()
                  : null;
              const who =
                fromLog ??
                (returnUid && currentOperatorLabel?.trim()
                  ? currentOperatorLabel.trim()
                  : null);
              return who ? ` · ${who}` : null;
            })()}
          </p>
          <p className="mt-1.5 break-all font-mono text-xs text-emerald-800/90 dark:text-emerald-300/90">
            {returnUid}
          </p>
          <p className="mt-1.5 text-xs text-emerald-800/90 dark:text-emerald-300/90">
            Customer email: {regEmail ? "Sent (logged)" : "Not yet"} ·
            Refund complete: {regRefund ? "Yes (logged)" : "Not yet"}{" "}
            {returnUid && (
              <span className="ml-0.5 inline">
                <Link
                  className="font-medium underline"
                  href={`/returns/logged/${encodeURIComponent(returnUid)}`}
                >
                  Open log entry
                </Link>
              </span>
            )}
          </p>
        </div>
      ) : null}

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <input
          ref={masterCheckboxRef}
          type="checkbox"
          checked={allReturned}
          onChange={(e) => {
            const next = e.target.checked;
            setEntireOrderReturned(next);
            toast.message(
              next ? "Entire order marked returned" : "Cleared all line selections",
            );
          }}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-400 text-amber-600 focus:ring-amber-500"
        />
        <span>
          <span className="block text-sm font-medium text-foreground">
            Entire order has been returned
          </span>
          <span className="mt-0.5 block text-sm text-zinc-600 dark:text-zinc-400">
            Selects every line on this order as received back. Uncheck to clear
            all selections.
          </span>
        </span>
      </label>

      <ul className="flex flex-col gap-3">
        {lines.map((line) => {
          const row = byId[line.id];
          const s = {
            ...emptyLine(),
            ...row,
            reason: reasonValueForSharedReturnSelect(row?.reason),
            rejectNotifyCustomer: Boolean(row?.rejectNotifyCustomer),
          };
          const lineTotal = line.unitPrice * line.quantity;
          const idBase = safeDomId(line.id);
          const checkboxId = `rl-${idBase}`;
          const reasonFieldId = `rsn-${idBase}`;
          const selected = s.selected;
          return (
            <li key={line.id}>
              <div
                className={`rounded-xl border-2 transition-colors ${
                  selected
                    ? "border-amber-400 bg-amber-50/90 shadow-sm dark:border-amber-500/80 dark:bg-amber-950/35"
                    : "border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/40"
                }`}
              >
                <div className="flex gap-3 p-4 sm:items-start">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white dark:border-zinc-600">
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={selected}
                      onChange={(e) =>
                        setLineSelected(line.id, e.currentTarget.checked)
                      }
                      className="h-5 w-5 rounded border-zinc-400 text-amber-600 focus:ring-amber-500"
                      aria-label={`Include ${line.title} in this return`}
                    />
                  </span>
                  <div
                    className="flex min-w-0 flex-1 cursor-pointer gap-3 sm:items-start"
                    onClick={() => setLineSelected(line.id, !selected)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setLineSelected(line.id, !selected);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Toggle line: ${line.title}`}
                  >
                    <ReturnLineThumbnail line={line} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{line.title}</p>
                      <p className="mt-0.5 font-mono text-xs text-zinc-500">
                        {lineSkuForWarehouseUi(line)} · Qty {line.quantity}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {formatGbp(line.unitPrice)} each ·{" "}
                        <span className="font-semibold text-foreground">
                          Line {formatGbp(lineTotal)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className={`border-t border-amber-200/80 px-4 pb-4 pt-3 dark:border-amber-900/50 ${
                    selected ? "" : "bg-zinc-50/80"
                  }`}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={reasonFieldId}
                        className="block text-xs font-medium uppercase tracking-wide text-zinc-500"
                      >
                        Reason for return (optional)
                      </label>
                      <select
                        id={reasonFieldId}
                        name={`reason-${idBase}`}
                        value={s.reason}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) {
                            updateLine(line.id, {
                              reason: CUSTOMER_FORM_REASON_UNSET,
                              disposition: "restock",
                              rejectNotifyCustomer: false,
                            });
                            return;
                          }
                          const { disposition } = mapCustomerFormReasonToWarehouse(v);
                          updateLine(line.id, { reason: v, disposition });
                        }}
                        className="mt-1.5 min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-amber-500/60 sm:text-sm dark:border-zinc-600"
                      >
                        {CUSTOMER_FORM_REASON_SELECT_OPTIONS.map((opt) => (
                          <option key={String(opt.value) || "unset"} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <fieldset className="min-w-0">
                      <legend className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Warehouse handling
                      </legend>
                      <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                        {WAREHOUSE_HANDLING_OPTIONS.map(({ value: disp, label }) => (
                          <label
                            key={disp}
                            className={dispositionRadioSurface(disp, s.disposition)}
                          >
                            <input
                              type="radio"
                              name={`disp-${idBase}`}
                              checked={s.disposition === disp}
                              onChange={() => {
                                const allowsReject =
                                  dispositionCountsTowardCustomerRefund(disp);
                                updateLine(line.id, {
                                  disposition: disp,
                                  ...(!allowsReject
                                    ? { rejectNotifyCustomer: false }
                                    : {}),
                                });
                              }}
                              className={
                                s.disposition === disp
                                  ? "accent-zinc-900 dark:accent-zinc-100"
                                  : "accent-zinc-400"
                              }
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                  <div className="mt-3 border-t border-amber-200/60 pt-3 dark:border-amber-900/40">
                    <button
                      type="button"
                      onClick={() =>
                        setNotesOpenByLine((p) => ({
                          ...p,
                          [line.id]: !p[line.id],
                        }))
                      }
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                      aria-expanded={Boolean(notesOpenByLine[line.id])}
                      aria-controls={`notes-${idBase}`}
                    >
                      <Plus className="h-4 w-4 shrink-0" weight="bold" aria-hidden />
                      Notes
                      {showRejectCustomerKlaviyoUi && s.rejectNotifyCustomer ? (
                        <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                          (rejection note required)
                        </span>
                      ) : s.notes.trim() ? (
                        <span className="text-xs font-normal text-zinc-500">
                          (saved text)
                        </span>
                      ) : null}
                    </button>
                    {notesOpenByLine[line.id] ? (
                      <div className="mt-2" id={`notes-${idBase}`}>
                        <label
                          htmlFor={`notes-ta-${idBase}`}
                          className="sr-only"
                        >
                          Notes for {line.title}
                        </label>
                        <textarea
                          id={`notes-ta-${idBase}`}
                          value={s.notes}
                          maxLength={MAX_RETURN_LINE_NOTES}
                          rows={3}
                          placeholder={
                            showRejectCustomerKlaviyoUi && s.rejectNotifyCustomer
                              ? "Required: why is this item being rejected for the customer?"
                              : "Optional notes for this line…"
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            const noteTrim = clampReturnLineNotes(v).trim();
                            updateLine(line.id, {
                              notes: v,
                              ...(showRejectCustomerKlaviyoUi &&
                              noteTrim === "" &&
                              s.rejectNotifyCustomer
                                ? { rejectNotifyCustomer: false }
                                : {}),
                            });
                          }}
                          className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-amber-500/50 dark:border-zinc-600 dark:bg-zinc-950"
                        />
                        <p className="mt-1 text-xs text-zinc-500">
                          {s.notes.length}/{MAX_RETURN_LINE_NOTES}
                          {selected
                            ? " · Shown on logged returns / refund list"
                            : " · Saved when you tick this line and log the return"}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  {selected && showRejectCustomerKlaviyoUi ? (
                    dispositionCountsTowardCustomerRefund(
                      normalizeReturnLineDisposition(s.disposition),
                    ) ? (
                      <div className="mt-3">
                        <label
                          htmlFor={`reject-${idBase}`}
                          className="flex cursor-pointer items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/90 px-3 py-2.5 text-sm dark:border-rose-900/50 dark:bg-rose-950/25"
                        >
                          <input
                            id={`reject-${idBase}`}
                            type="checkbox"
                            checked={Boolean(s.rejectNotifyCustomer)}
                            onChange={(e) => {
                              const on = e.currentTarget.checked;
                              if (
                                on &&
                                !clampReturnLineNotes(s.notes ?? "").trim()
                              ) {
                                toast.warning("Add a rejection note first", {
                                  description:
                                    "Open Notes above and explain why this item is rejected before emailing the customer.",
                                });
                                setNotesOpenByLine((p) => ({
                                  ...p,
                                  [line.id]: true,
                                }));
                                return;
                              }
                              updateLine(line.id, {
                                rejectNotifyCustomer: on,
                              });
                            }}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-rose-400 text-rose-600 focus:ring-rose-500"
                          />
                          <span>
                            <span className="font-medium text-rose-950 dark:text-rose-100">
                              Reject — email customer (Klaviyo)
                            </span>
                            <span className="mt-0.5 block text-xs text-rose-900/90 dark:text-rose-200/85">
                              Requires a{" "}
                              <strong className="font-semibold">Notes</strong>{" "}
                              explanation above. Sends this line in “Return Submitted”
                              with product name, size, and return reason.
                            </span>
                          </span>
                        </label>
                      </div>
                    ) : (
                      <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/90 px-3 py-2.5 text-xs leading-relaxed text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
                        <span className="font-medium text-foreground">
                          Reject — email customer
                        </span>{" "}
                        is not used when handling is{" "}
                        <span className="font-medium">Return to sender</span> or{" "}
                        <span className="font-medium">Wrong item received</span> — the
                        same lines are excluded from refund value above.
                      </p>
                    )
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {showRejectCustomerKlaviyoUi ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/50 dark:bg-rose-950/25">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-800 dark:text-rose-200/90">
            Rejected items · customer email
          </p>
          <p className="mt-1.5 text-sm text-rose-900/95 dark:text-rose-100/90">
            Shown because this return includes{" "}
            <span className="font-medium">Return to sender</span> on at least one selected
            line. On each <em className="not-italic">other</em> eligible line (not Return to
            sender / Wrong item received), add a <strong className="font-semibold">Notes</strong>{" "}
            explanation, then tick{" "}
            <span className="font-medium">Reject — email customer</span>. Items without a
            note cannot be emailed. Klaviyo receives{" "}
            <span className="font-medium">Return Submitted</span> with name, size, and return
            reason per line.
          </p>
          <p className="mt-2 text-sm text-foreground">
            <span className="text-zinc-600 dark:text-zinc-400">
              Lines ready to send (with note):{" "}
            </span>
            <span className="font-semibold tabular-nums">
              {rejectedNotifyReadyCount}
            </span>
          </p>
          {!notifyCustomer ? (
            <p className="mt-2 text-xs text-rose-800/90 dark:text-rose-200/80">
              No customer email on file for this order — add one in Shopify or use a
              return with a customer form so Klaviyo can target the profile.
            </p>
          ) : null}
          <button
            type="button"
            className="mt-3 inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-950 shadow-sm transition-colors hover:bg-rose-50 disabled:opacity-50 sm:min-h-10 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50 dark:hover:bg-rose-950/70"
            disabled={
              returnBusy || !notifyCustomer || rejectedNotifyReadyCount === 0
            }
            onClick={() => {
              void sendRejectedItemsKlaviyo();
            }}
          >
            <Prohibit className="h-5 w-5 shrink-0" weight="duotone" aria-hidden />
            Email customer about rejected items
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <a
          href={shopifyAdminHref}
          target="_blank"
          rel="noopener noreferrer"
          title="Refund order in Shopify admin (new tab)"
          className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-lg border border-[#006e52] bg-[#008060] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#006e52] active:bg-[#005a47] focus:outline-none focus:ring-2 focus:ring-[#008060] focus:ring-offset-2 sm:min-h-10"
        >
          <Storefront className="h-5 w-5 shrink-0 text-white" weight="fill" aria-hidden />
          Refund in Shopify
        </a>
        {returnUid && !returnBusy && !regRefund ? (
          <button
            type="button"
            className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-800 shadow-sm transition-colors hover:bg-red-50 sm:min-h-10 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/50"
            onClick={() => {
              setRefundModalOpen(true);
              toast.message("Confirm refund complete", {
                description: `${formatGbp(fullOrderTotal)} — check the dialog.`,
              });
            }}
          >
            <CurrencyGbp
              className="h-5 w-5 shrink-0 text-red-800 dark:text-red-200"
              weight="duotone"
              aria-hidden
            />
            Mark as refund complete ({formatGbp(fullOrderTotal)})
          </button>
        ) : null}
        {returnUid && !returnBusy && !regEmail ? (
          <button
            type="button"
            className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-zinc-50 sm:min-h-10 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            onClick={() => {
              void sendReceivedEmail();
            }}
          >
            <EnvelopeSimple
              className="h-5 w-5 shrink-0 text-foreground"
              weight="duotone"
              aria-hidden
            />
            Email Customer Items Received
          </button>
        ) : null}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-background p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">
            Lines marked for return
          </span>
          <span className="font-medium text-foreground">{selectedCount}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2 text-sm dark:border-zinc-800">
          <span className="text-zinc-600 dark:text-zinc-400">
            Refund value (selected lines)
            <span className="mt-0.5 block text-xs font-normal text-zinc-500">
              Excludes “Return to sender” and “Wrong item received”.
            </span>
          </span>
          <span className="font-semibold text-foreground">
            {formatGbp(selectedRefund)}
          </span>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity enabled:hover:opacity-90 active:enabled:opacity-90 disabled:opacity-50"
            disabled={saving}
            onClick={() => {
              void submitLogReturn();
            }}
          >
            {saving ? "Saving…" : "Log & notify customer"}
          </button>
        </div>
      </div>

      {refundModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setRefundModalOpen(false)}
          />
          <div
            className="relative z-[101] w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="refund-modal-title"
          >
            <h2
              id="refund-modal-title"
              className="text-lg font-semibold text-foreground"
            >
              Mark as refund complete?
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              This will record that the full refund of{" "}
              <span className="font-semibold text-foreground">
                {formatGbp(fullOrderTotal)}
              </span>{" "}
              for order{" "}
              <span className="font-mono font-medium">{orderLabel}</span> is
              complete. This cannot be undone from this screen.
            </p>
            <p className="mt-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Are you sure?
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-foreground hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                onClick={() => {
                  setRefundModalOpen(false);
                  toast.message("Refund cancelled");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-medium text-white enabled:hover:bg-red-800 disabled:opacity-50"
                disabled={returnBusy}
                onClick={() => {
                  void confirmFullRefund();
                }}
              >
                Yes, mark as complete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
