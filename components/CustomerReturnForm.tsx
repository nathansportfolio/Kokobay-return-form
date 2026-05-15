"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KokobayOrderLine } from "@/lib/kokobayOrderLines";
import { formatGbp } from "@/lib/kokobayOrderLines";
import { lineSkuForWarehouseUi } from "@/lib/returnLineSkuDisplay";
import { isVariantIdPlaceholderSku } from "@/lib/variantIdPlaceholderSku";
import {
  CUSTOMER_FORM_REASONS,
  CUSTOMER_FORM_REASON_UNSET,
  isCustomerFormReturnReasonValue,
} from "@/lib/customerReturnFormReasons";
import {
  logReturnsOrderLookupClient,
  queryDiagnosticsForOrderString,
} from "@/lib/customerReturnOrderPreviewLog";
import {
  EnvelopeSimple,
  FileText,
  ListChecks,
  MagnifyingGlass,
  Plus,
  Truck,
} from "@phosphor-icons/react";
import {
  MAX_RETURN_LINE_NOTES,
  clampReturnLineNotes,
} from "@/lib/returnLineNotes";
import { toast } from "sonner";

const RETURNS_ADDRESS = `KOKOBAY RETURNS
UNITS 8 & 9 ATLANTIC BUSINESS CENTRE
ATLANTIC STREET
ALTRINCHAM
WA14 5NQ`;

/** Public returns form: show Shopify/catalog SKU as-is (no warehouse `KOKO-` display prefix). */
function customerReturnLineSkuDisplay(line: KokobayOrderLine): string {
  const raw = String(line.sku ?? "").trim();
  if (!raw) return "—";
  if (isVariantIdPlaceholderSku(raw)) {
    return lineSkuForWarehouseUi(line);
  }
  return raw;
}

function FormLineThumb({
  line,
}: {
  line: Pick<KokobayOrderLine, "id" | "sku" | "imageUrl">;
}) {
  const primary = line.imageUrl?.trim();
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [line.id, primary]);
  if (!primary || broken) return null;
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
      <img
        src={primary}
        alt=""
        width={64}
        height={64}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setBroken(true)}
      />
    </div>
  );
}

type PerLine = {
  include: boolean;
  reasonValue: string;
  notes: string;
};

export function CustomerReturnForm() {
  const [orderInput, setOrderInput] = useState("");
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [lines, setLines] = useState<KokobayOrderLine[] | null>(null);
  const [loadBusy, setLoadBusy] = useState(false);
  const [byLine, setByLine] = useState<Record<string, PerLine>>({});
  const [notesOpenByLine, setNotesOpenByLine] = useState<Record<string, boolean>>(
    {},
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [datePosted, setDatePosted] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [successUid, setSuccessUid] = useState<string | null>(null);
  const orderLoadedAnchorRef = useRef<HTMLDivElement>(null);
  const entireOrderCheckboxRef = useRef<HTMLInputElement>(null);

  const allLinesIncluded = useMemo(
    () =>
      lines != null &&
      lines.length > 0 &&
      lines.every((l) => byLine[l.id]?.include),
    [lines, byLine],
  );
  const someLinesIncluded = useMemo(
    () => lines?.some((l) => byLine[l.id]?.include) ?? false,
    [lines, byLine],
  );

  useEffect(() => {
    const el = entireOrderCheckboxRef.current;
    if (!el) return;
    el.indeterminate = someLinesIncluded && !allLinesIncluded;
  }, [someLinesIncluded, allLinesIncluded]);

  useEffect(() => {
    if (!lines?.length) return;
    const id = requestAnimationFrame(() => {
      orderLoadedAnchorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [lines]);

  const onLoadOrder = useCallback(async () => {
    const o = orderInput.trim();
    if (o.length < 2) {
      logReturnsOrderLookupClient("lookup_blocked_short_input", {
        orderInput: o,
        orderInputLength: o.length,
        queryDiagnostics: queryDiagnosticsForOrderString(o),
      });
      toast.error("Enter your order number");
      return;
    }
    logReturnsOrderLookupClient("lookup_attempt", {
      orderInput: o,
      orderInputLength: o.length,
      queryDiagnostics: queryDiagnosticsForOrderString(o),
    });
    setLoadBusy(true);
    setSuccessUid(null);
    try {
      const res = await fetch(
        `/api/returns/preview-order?order=${encodeURIComponent(o)}`,
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        lines?: KokobayOrderLine[];
        orderRef?: string;
        error?: string;
      };
      logReturnsOrderLookupClient("lookup_response", {
        orderInput: o,
        queryDiagnostics: queryDiagnosticsForOrderString(o),
        httpStatus: res.status,
        responseOk: res.ok,
        payloadOk: data.ok,
        orderRef: data.orderRef,
        lineCount: data.lines?.length ?? 0,
        error: data.error,
      });
      if (!res.ok || !data.ok || !data.lines?.length) {
        toast.error(data.error ?? "No lines found for that order. Check the number and try again.");
        setLines(null);
        setOrderRef(null);
        return;
      }
      setOrderRef(data.orderRef ?? o);
      setOrderInput(data.orderRef ?? o);
      setLines(data.lines);
      const next: Record<string, PerLine> = {};
      for (const l of data.lines) {
        next[l.id] = {
          include: false,
          reasonValue: CUSTOMER_FORM_REASON_UNSET,
          notes: "",
        };
      }
      setByLine(next);
    } finally {
      setLoadBusy(false);
    }
  }, [orderInput]);

  const toggleEntireOrder = useCallback(
    (selectAll: boolean) => {
      if (!lines?.length) return;
      if (!selectAll) {
        setNotesOpenByLine({});
      }
      setByLine((prev) => {
        const next = { ...prev };
        for (const l of lines) {
          if (!selectAll) {
            next[l.id] = {
              include: false,
              reasonValue: CUSTOMER_FORM_REASON_UNSET,
              notes: "",
            };
          } else {
            const prevRow = prev[l.id];
            const keepReason =
              prevRow && isCustomerFormReturnReasonValue(prevRow.reasonValue)
                ? prevRow.reasonValue
                : CUSTOMER_FORM_REASON_UNSET;
            next[l.id] = {
              include: true,
              reasonValue: keepReason,
              notes: prevRow?.notes ?? "",
            };
          }
        }
        return next;
      });
    },
    [lines],
  );

  const onSubmit = useCallback(async () => {
    if (!orderRef || !lines?.length) {
      toast.error("Load your order first");
      return;
    }
    if (!name.trim() || !email.trim() || !datePosted) {
      toast.error("Fill in your name, email, and the date you posted the parcel");
      return;
    }
    const items: {
      lineId: string;
      sku: string;
      title: string;
      quantity: number;
      reasonValue: string;
    }[] = [];
    for (const line of lines) {
      const s = byLine[line.id];
      if (!s?.include) continue;
      const notesTrimmed = clampReturnLineNotes(s.notes ?? "");
      items.push({
        lineId: line.id,
        sku: line.sku,
        title: line.title,
        quantity: line.quantity,
        reasonValue: s.reasonValue,
        ...(notesTrimmed ? { notes: notesTrimmed } : {}),
      });
    }
    if (items.length === 0) {
      toast.error("Select at least one item you are sending back");
      return;
    }
    for (const line of lines) {
      const s = byLine[line.id];
      if (!s?.include) continue;
      if (!isCustomerFormReturnReasonValue(s.reasonValue)) {
        toast.error("Choose a return reason for every item you are sending back");
        return;
      }
    }
    setSubmitBusy(true);
    try {
      const res = await fetch("/api/returns/customer-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderRef,
          customerName: name.trim(),
          customerEmail: email.trim(),
          datePosted,
          items,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        submissionUid?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.submissionUid) {
        toast.error(data.error ?? "Could not submit");
        return;
      }
      setSuccessUid(data.submissionUid);
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success("Return form submitted", {
        description: "We’ll email you when we’ve received your parcel.",
      });
    } finally {
      setSubmitBusy(false);
    }
  }, [byLine, datePosted, email, lines, name, orderRef]);

  if (successUid) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 text-zinc-800 dark:text-zinc-200">
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-5 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
          role="status"
        >
          <h2 className="text-lg font-semibold">Thank you — we’ve received your form</h2>
          <p className="mt-1 text-sm">
            Reference:{" "}
            <span className="break-all font-mono font-medium">{successUid}</span>
          </p>
          <p className="mt-3 text-sm text-emerald-800/95 dark:text-emerald-200/90">
            If you have not posted your return yet, use the address below. We will email
            you when the parcel has arrived. Refunds are usually processed within{" "}
            <strong className="font-semibold">5–10 working days</strong> after we receive
            the items.
          </p>
          <div
            className="mt-4 whitespace-pre-line border-2 border-emerald-800/30 bg-white/60 p-3 text-[0.7rem] font-semibold leading-snug text-emerald-950 sm:text-xs dark:border-emerald-700/40 dark:bg-emerald-950/20 dark:text-emerald-100"
            role="group"
            aria-label="Returns address"
          >
            {RETURNS_ADDRESS}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSuccessUid(null);
              setLines(null);
              setOrderRef(null);
              setByLine({});
              setName("");
              setEmail("");
              setDatePosted("");
            }}
            className="min-h-11 w-full touch-manipulation rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background sm:w-auto"
          >
            Start another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 text-zinc-800 sm:space-y-8 dark:text-zinc-200">
      <header>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          HOW TO RETURN: RETURNS FORM
        </h1>
        <p className="mt-8 text-sm leading-relaxed text-zinc-500 sm:mt-10 mb-12 sm:mb-16">
          Enter your order number, choose what you are sending back (a reason is required
          for each item), then post to our address. We email you when we have your parcel,
          and we aim to
          refund within{" "}
          <strong className="font-semibold text-zinc-700 dark:text-zinc-300">5–10 working days</strong>.
        </p>
      </header>

      <section
        className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 text-base leading-relaxed text-zinc-800 sm:p-4 sm:text-sm dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-200"
        aria-label="Instructions"
      >
        <ul className="space-y-3" role="list" aria-label="How to return, step by step">
          <li className="flex gap-3">
            <MagnifyingGlass
              className="mt-0.5 h-6 w-6 shrink-0 text-black dark:text-zinc-100"
              weight="duotone"
              aria-hidden
            />
            <span>Enter your order number and load your items.</span>
          </li>
          <li className="flex gap-3">
            <ListChecks
              className="mt-0.5 h-6 w-6 shrink-0 text-black dark:text-zinc-100"
              weight="duotone"
              aria-hidden
            />
            <span>
              Tick the items you are returning. You must choose a return reason for each
              selected item.
            </span>
          </li>
          <li className="flex gap-3">
            <FileText
              className="mt-0.5 h-6 w-6 shrink-0 text-black dark:text-zinc-100"
              weight="duotone"
              aria-hidden
            />
            <span>
              Put the <strong className="font-semibold">original A4 paper</strong> from
              your delivery (the sheet that shows your order details) inside the parcel
              with your items. If you no longer have it,{" "}
              <strong className="font-semibold">write your order number clearly on a slip
              of paper</strong> and place that inside the parcel instead—this helps us
              match your return to your form and avoids delays.
            </span>
          </li>
          <li className="flex gap-3">
            <Truck
              className="mt-0.5 h-6 w-6 shrink-0 text-black dark:text-zinc-100"
              weight="duotone"
              aria-hidden
            />
            <span>
              Submit the form, then post your return to the address below (use a tracked
              or signed-for service and keep your proof of postage).
            </span>
          </li>
          <li className="flex gap-3">
            <EnvelopeSimple
              className="mt-0.5 h-6 w-6 shrink-0 text-black dark:text-zinc-100"
              weight="duotone"
              aria-hidden
            />
            <span>
              We email you when we have received the parcel. Refund within 5–10 working
              days.
            </span>
          </li>
        </ul>
        <div
          className="rounded-lg border border-dashed border-zinc-400 bg-white/70 px-3 py-2.5 sm:px-4 dark:border-zinc-600 dark:bg-zinc-950/35"
          role="note"
          aria-label="What to include in your parcel"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-400">
            Check before you seal the box
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-snug text-zinc-800 marker:font-medium dark:text-zinc-200">
            <li>The item(s) you are returning</li>
            <li>
              The original A4 order sheet, or a clear written reference to your order
              number
            </li>
          </ol>
        </div>
        <p>
          Re-pack the item(s) in the original packaging where possible, with tags still
          attached. You are responsible for the parcel until it reaches us, so pack
          items securely. Follow the paperwork step above so we can identify your parcel.
          If we cannot match a return to a{" "}
          <strong className="font-semibold">submitted form</strong>, processing may
          be delayed.
        </p>
        <p className="mt-3">
          Before you post anything, scroll down this page to the{" "}
          <strong className="font-semibold">Find your order</strong> section, enter the
          order number from your confirmation email, and tap{" "}
          <strong className="font-semibold">Load order</strong>. Then complete the returns
          form further down (tick items, choose a reason for each, fill in your details,
          and submit). We need that form on file so we can match your parcel when it
          arrives.
        </p>
        <div
          className="whitespace-pre-line border-2 border-zinc-900 p-2.5 text-[0.7rem] font-semibold leading-snug text-foreground sm:p-3 sm:text-xs sm:leading-relaxed dark:border-zinc-200"
          role="group"
          aria-label="Returns address"
        >
          {RETURNS_ADDRESS}
        </div>
      </section>

      <section className="space-y-3" aria-label="Order lookup">
        <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
          Find your order
        </h2>
        <p className="text-sm text-zinc-500">
          Enter the order number from your confirmation; we will show items to return.
        </p>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 sm:max-w-xs">
            <span className="text-sm font-medium">Order number</span>
            <input
              value={orderInput}
              onChange={(e) => setOrderInput(e.target.value)}
              className="mt-1.5 w-full min-h-12 rounded-lg border border-zinc-300 bg-background px-3 py-2.5 text-base text-foreground sm:min-h-10 sm:py-2 sm:text-sm"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            disabled={loadBusy}
            onClick={() => void onLoadOrder()}
            className="min-h-12 w-full touch-manipulation rounded-lg bg-foreground px-4 text-base font-medium text-background enabled:hover:opacity-90 disabled:opacity-50 sm:min-h-10 sm:w-auto sm:shrink-0 sm:px-5 sm:text-sm"
          >
            {loadBusy ? "Loading…" : "Load order"}
          </button>
        </div>
      </section>

      {lines && orderRef ? (
        <>
          <section
            ref={orderLoadedAnchorRef}
            className="scroll-mt-4 space-y-3 border-t border-zinc-200 pt-4 sm:scroll-mt-6 sm:pt-6"
            aria-label="Return lines"
          >
            <h2 className="text-base font-semibold">Items you are returning</h2>
            <p className="text-sm text-zinc-500">
              Tick each item you are sending back. Choose a return reason for every item you
              select.
            </p>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-3 sm:items-center sm:px-4 dark:border-zinc-700 dark:bg-zinc-900/40">
              <input
                ref={entireOrderCheckboxRef}
                type="checkbox"
                className="mt-0.5 h-5 w-5 min-h-5 min-w-5 shrink-0 cursor-pointer touch-manipulation rounded border-zinc-400 text-amber-600 focus:ring-2 focus:ring-amber-500/40 sm:mt-0"
                checked={allLinesIncluded}
                onChange={(e) => toggleEntireOrder(e.target.checked)}
                aria-controls="customer-return-line-list"
              />
              <span className="min-w-0">
                <span className="font-medium text-foreground">Entire order</span>
                <span className="mt-0.5 block text-sm text-zinc-600 dark:text-zinc-400">
                  Select or clear every line at once. You still need a return reason on each
                  selected item before you submit.
                </span>
              </span>
            </label>
            <ul
              id="customer-return-line-list"
              className="space-y-3 sm:space-y-4"
            >
              {lines.map((line) => {
                const s = byLine[line.id] ?? {
                  include: false,
                  reasonValue: CUSTOMER_FORM_REASON_UNSET,
                  notes: "",
                };
                return (
                  <li
                    key={line.id}
                    className="rounded-lg border border-zinc-200 bg-white p-3 sm:p-4 dark:border-zinc-800 dark:bg-zinc-900/30"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                    <div className="sm:pt-0.5">
                      <FormLineThumb line={line} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-5 w-5 min-h-5 min-w-5 shrink-0 cursor-pointer touch-manipulation rounded border-zinc-400 text-amber-600 focus:ring-2 focus:ring-amber-500/40"
                          checked={s.include}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            if (!checked) {
                              setNotesOpenByLine((p) => {
                                const next = { ...p };
                                delete next[line.id];
                                return next;
                              });
                            }
                            setByLine((prev) => ({
                              ...prev,
                              [line.id]: {
                                include: checked,
                                reasonValue: checked
                                  ? prev[line.id]?.reasonValue ??
                                    CUSTOMER_FORM_REASON_UNSET
                                  : CUSTOMER_FORM_REASON_UNSET,
                                notes: checked ? prev[line.id]?.notes ?? "" : "",
                              },
                            }));
                          }}
                        />
                        <div className="min-w-0">
                          <p className="font-medium leading-snug text-foreground">{line.title}</p>
                          <p className="mt-0.5 font-mono text-xs leading-relaxed text-zinc-500">
                            {customerReturnLineSkuDisplay(line)} · Qty {line.quantity} · {formatGbp(
                              line.unitPrice * line.quantity,
                            )}{" "}
                            line
                          </p>
                        </div>
                      </label>
                      {s.include ? (
                        <div className="mt-4 flex flex-col gap-2.5 pl-0 sm:pl-8 sm:pl-0">
                          <span
                            id={`reason-lbl-${line.id}`}
                            className="text-xs font-medium uppercase tracking-wide text-zinc-500"
                          >
                            Reason (required)
                          </span>
                          <select
                            id={`reason-sel-${line.id}`}
                            required
                            className="w-full min-h-12 max-w-md rounded-lg border border-zinc-300 bg-background px-3 py-2.5 text-base text-foreground sm:min-h-11 sm:text-sm"
                            aria-labelledby={`reason-lbl-${line.id}`}
                            value={s.reasonValue}
                            onChange={(e) =>
                              setByLine((prev) => ({
                                ...prev,
                                [line.id]: {
                                  ...s,
                                  reasonValue: e.target.value,
                                  notes: prev[line.id]?.notes ?? s.notes ?? "",
                                },
                              }))
                            }
                          >
                            <option value="" disabled>
                              Select a reason…
                            </option>
                            {CUSTOMER_FORM_REASONS.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                          <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                            <button
                              type="button"
                              onClick={() =>
                                setNotesOpenByLine((p) => ({
                                  ...p,
                                  [line.id]: !p[line.id],
                                }))
                              }
                              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-300 bg-background px-3 py-2 text-sm font-medium text-foreground"
                              aria-expanded={Boolean(notesOpenByLine[line.id])}
                              aria-controls={`cust-notes-${line.id}`}
                            >
                              <Plus className="h-4 w-4 shrink-0" weight="bold" aria-hidden />
                              Notes
                              {s.notes.trim() ? (
                                <span className="text-xs font-normal text-zinc-500">
                                  (has text)
                                </span>
                              ) : null}
                            </button>
                            {notesOpenByLine[line.id] ? (
                              <div className="mt-2" id={`cust-notes-${line.id}`}>
                                <label
                                  htmlFor={`cust-notes-ta-${line.id}`}
                                  className="sr-only"
                                >
                                  Notes for {line.title}
                                </label>
                                <textarea
                                  id={`cust-notes-ta-${line.id}`}
                                  value={s.notes}
                                  maxLength={MAX_RETURN_LINE_NOTES}
                                  rows={3}
                                  placeholder="Optional notes…"
                                  onChange={(e) =>
                                    setByLine((prev) => ({
                                      ...prev,
                                      [line.id]: {
                                        ...s,
                                        notes: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full resize-y rounded-lg border border-zinc-300 bg-background px-3 py-2 text-sm text-foreground"
                                />
                                <p className="mt-1 text-xs text-zinc-500">
                                  {s.notes.length}/{MAX_RETURN_LINE_NOTES}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section
            className="space-y-4 border-t border-zinc-200 pt-6"
            aria-label="Your details"
          >
            <h2 className="text-base font-semibold">Your details</h2>
            <p className="text-sm text-zinc-500">
              Use the name and email from your order. The date is when you posted the
              parcel to us.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
              <label className="min-w-0 sm:col-span-1">
                <span className="text-sm font-medium">Your name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full min-h-12 rounded-lg border border-zinc-300 bg-background px-3 py-2.5 text-base text-foreground sm:min-h-10 sm:py-2 sm:text-sm"
                  autoComplete="name"
                />
              </label>
              <label className="min-w-0">
                <span className="text-sm font-medium">Your email</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="mt-1.5 w-full min-h-12 rounded-lg border border-zinc-300 bg-background px-3 py-2.5 text-base text-foreground sm:min-h-10 sm:py-2 sm:text-sm"
                  autoComplete="email"
                />
              </label>
              <label className="min-w-0">
                <span className="text-sm font-medium">Order number</span>
                <input
                  value={orderRef}
                  readOnly
                  className="mt-1.5 w-full min-h-12 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2.5 text-base text-foreground sm:min-h-10 sm:py-2 sm:text-sm"
                />
              </label>
              <label className="min-w-0">
                <span className="text-sm font-medium">Date you plan to send back</span>
                <input
                  type="date"
                  value={datePosted}
                  onChange={(e) => setDatePosted(e.target.value)}
                  className="mt-1.5 w-full min-h-12 rounded-lg border border-zinc-300 bg-background px-3 py-2.5 text-base text-foreground sm:min-h-10 sm:py-2 sm:text-sm"
                />
              </label>
            </div>
          </section>

          <section
            className="space-y-2 rounded border border-amber-200/80 bg-amber-50/50 p-3 text-sm sm:p-4 dark:border-amber-900/40 dark:bg-amber-950/20"
            aria-label="Returns policy"
          >
            <h2 className="font-semibold text-amber-950 dark:text-amber-100/95">
              PLEASE READ – Returns policy
            </h2>
            <p>
              Items that you wish to return must be posted back no later than{" "}
              <strong className="font-semibold">14 working days</strong> from
              the date you receive them. We will not accept returns after this
              time has passed.
            </p>
            <p>
              Please take care when trying on your new items. Any damage such as (but not
              limited to) makeup stains, washed items, deodorant, perfume, pet hairs,
              stains, spills, discolouration, tampered tags, general wear and tear will
              be refused, and your order will be sent back to you.
            </p>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              disabled={submitBusy}
              onClick={() => void onSubmit()}
              className="min-h-12 w-full touch-manipulation rounded-lg bg-foreground px-4 text-base font-medium text-background enabled:hover:opacity-90 disabled:opacity-50 sm:min-h-10 sm:max-w-sm sm:px-5 sm:text-sm"
            >
              {submitBusy ? "Submitting…" : "Submit return form"}
            </button>
          </div>
        </>
      ) : null}

    </div>
  );
}
