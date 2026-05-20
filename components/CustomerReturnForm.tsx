"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CUSTOMER_RETURN_SUCCESS_PREVIEW_PARAM,
  parseCustomerReturnSuccessPreview,
} from "@/lib/customerReturnSuccessPreview";
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
import { RETURN_WINDOW_EXPIRED_MESSAGE } from "@/lib/returnEligibilityWindow";
import {
  EnvelopeSimple,
  FileText,
  ListChecks,
  MagnifyingGlass,
  Plus,
  QrCode,
  Storefront,
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

const INPOST_RETURNS_URL = "https://returns.inpost.co.uk/kokobayreturns";

const SUCCESS_CARD_CLASS =
  "rounded-2xl border border-zinc-200/90 bg-white p-6 text-zinc-900 shadow-[0_4px_28px_-6px_rgba(0,0,0,0.08)] sm:p-8 dark:border-zinc-700/60 dark:bg-zinc-950 dark:text-zinc-50 dark:shadow-[0_4px_28px_-6px_rgba(0,0,0,0.35)]";

const SUCCESS_BODY_CLASS =
  "text-[0.9375rem] leading-relaxed text-zinc-600 dark:text-zinc-300";

const SUCCESS_CTA_CLASS =
  "inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-xl bg-foreground px-6 py-3.5 text-sm font-medium tracking-normal text-background no-underline shadow-[0_2px_14px_-3px_rgba(0,0,0,0.22)] transition-[transform,box-shadow,opacity] duration-200 hover:shadow-[0_6px_20px_-4px_rgba(0,0,0,0.28)] active:scale-[0.99] active:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.2)]";

function ParcelSealChecklist({ variant }: { variant: "instructions" | "success" }) {
  const shell =
    variant === "success"
      ? "border-zinc-200/80 bg-zinc-50/80 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-900/40"
      : "border-zinc-400 bg-white/70 dark:border-zinc-600 dark:bg-zinc-950/35";
  const title =
    variant === "success"
      ? "text-zinc-600 dark:text-zinc-400"
      : "text-zinc-600 dark:text-zinc-400";
  const list =
    variant === "success"
      ? "text-zinc-800 dark:text-zinc-200"
      : "text-zinc-800 dark:text-zinc-200";

  return (
    <div
      className={`rounded-xl border border-dashed px-4 py-3.5 sm:px-5 sm:py-4 ${shell}`}
      role="note"
      aria-label="What to include in your parcel"
    >
      <p
        className={`text-xs font-medium tracking-normal ${title} ${
          variant === "instructions" ? "uppercase tracking-[0.14em]" : ""
        }`}
      >
        Check before you seal the box
      </p>
      <ol
        className={`mt-2.5 list-decimal space-y-2 pl-5 text-sm leading-relaxed marker:font-medium ${list}`}
      >
        <li>The item(s) you are returning</li>
        <li>
          The original A4 order sheet, or a clear written reference to your order
          number
        </li>
      </ol>
    </div>
  );
}

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

type ReturnInstructionsRegion = "uk" | "outsideUk";

function ReturnInstructionsStep({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{
    className?: string;
    weight?: "duotone";
    "aria-hidden"?: boolean;
  }>;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <Icon
        className="mt-0.5 h-6 w-6 shrink-0 text-black dark:text-zinc-100"
        weight="duotone"
        aria-hidden
      />
      <span>{children}</span>
    </li>
  );
}

function UkReturnInstructions() {
  return (
    <section
      className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 text-base leading-relaxed text-zinc-800 sm:p-4 sm:text-sm dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-200"
      aria-label="Instructions for UK returns"
    >
      <ul className="space-y-3" role="list" aria-label="How to return, step by step">
        <ReturnInstructionsStep icon={MagnifyingGlass}>
          Enter your order number and the email address used on the order, then select
          the item(s) you wish to return.
        </ReturnInstructionsStep>
        <ReturnInstructionsStep icon={Storefront}>
          After submitting the form, press the{" "}
          <strong className="font-semibold">InPost Returns</strong> button to find your
          nearest InPost Locker or Shop.
        </ReturnInstructionsStep>
        <ReturnInstructionsStep icon={QrCode}>
          InPost will then email you a QR code to use at the locker — no printing
          required.
        </ReturnInstructionsStep>
        <ReturnInstructionsStep icon={EnvelopeSimple}>
          Once your parcel has been received and is being processed, we&apos;ll send you
          an email update.
        </ReturnInstructionsStep>
      </ul>
    </section>
  );
}

function OutsideUkReturnInstructions() {
  return (
    <section
      className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 text-base leading-relaxed text-zinc-800 sm:p-4 sm:text-sm dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-200"
      aria-label="Instructions for returns from outside the UK"
    >
      <ul className="space-y-3" role="list" aria-label="How to return, step by step">
        <ReturnInstructionsStep icon={MagnifyingGlass}>
          Enter your order number, the email on the order, and load your items.
        </ReturnInstructionsStep>
        <ReturnInstructionsStep icon={ListChecks}>
          Tick the items you are returning. You must choose a return reason for each
          selected item.
        </ReturnInstructionsStep>
        <ReturnInstructionsStep icon={FileText}>
          Put the <strong className="font-semibold">original A4 paper</strong> from your
          delivery (the sheet that shows your order details) inside the parcel with your
          items. If you no longer have it,{" "}
          <strong className="font-semibold">
            write your order number clearly on a slip of paper
          </strong>{" "}
          and place that inside the parcel instead—this helps us match your return to
          your form and avoids delays.
        </ReturnInstructionsStep>
        <ReturnInstructionsStep icon={Truck}>
          Submit the form, then post your return to the address below (use a tracked or
          signed-for service and keep your proof of postage).
        </ReturnInstructionsStep>
        <ReturnInstructionsStep icon={EnvelopeSimple}>
          We will email you once your return is being processed.
        </ReturnInstructionsStep>
      </ul>
      <ParcelSealChecklist variant="instructions" />
      <p>
        Re-pack the item(s) in the original packaging where possible, with tags still
        attached. You are responsible for the parcel until it reaches us, so pack items
        securely. Follow the paperwork step above so we can identify your parcel. If we
        cannot match a return to a{" "}
        <strong className="font-semibold">submitted form</strong>, processing may be
        delayed.
      </p>
      <p className="mt-3">
        Before you post anything, scroll down this page to the{" "}
        <strong className="font-semibold">Find your order</strong> section, enter the
        order number and email from your confirmation, and tap{" "}
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
  );
}

function CustomerReturnSuccessPreviewBanner({
  flow,
}: {
  flow: "inpost" | "post";
}) {
  const other =
    flow === "inpost"
      ? { href: `?${CUSTOMER_RETURN_SUCCESS_PREVIEW_PARAM}=post`, label: "Postal address" }
      : { href: `?${CUSTOMER_RETURN_SUCCESS_PREVIEW_PARAM}=inpost`, label: "InPost (UK)" };

  return (
    <div
      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100"
      role="note"
    >
      <p className="font-medium">Preview mode — not a real submission</p>
      <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">
        Switch:{" "}
        <a href={other.href} className="font-semibold underline underline-offset-2">
          {other.label}
        </a>
        {" · "}
        <a href="/" className="font-semibold underline underline-offset-2">
          Exit preview
        </a>
      </p>
    </div>
  );
}

export function CustomerReturnForm() {
  const searchParams = useSearchParams();
  const urlSuccessPreview = useMemo(
    () => parseCustomerReturnSuccessPreview(searchParams),
    [searchParams],
  );

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
  const [successDeliveryFlow, setSuccessDeliveryFlow] = useState<"inpost" | "post">(
    "post",
  );
  const [orderLookupError, setOrderLookupError] = useState<string | null>(null);
  const [returnWindowExpired, setReturnWindowExpired] = useState(false);
  const [instructionsRegion, setInstructionsRegion] =
    useState<ReturnInstructionsRegion>("uk");
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
    setOrderLookupError(null);
    setReturnWindowExpired(false);
    const o = orderInput.trim();
    const em = email.trim();
    if (o.length < 2) {
      logReturnsOrderLookupClient("lookup_blocked_short_input", {
        orderInput: o,
        orderInputLength: o.length,
        queryDiagnostics: queryDiagnosticsForOrderString(o),
      });
      setOrderLookupError("Enter your order number.");
      return;
    }
    if (em.length < 3 || !em.includes("@")) {
      setOrderLookupError(
        "Enter the email address from your order confirmation so we can verify it’s you.",
      );
      return;
    }
    logReturnsOrderLookupClient("lookup_attempt", {
      orderInput: o,
      orderInputLength: o.length,
      queryDiagnostics: queryDiagnosticsForOrderString(o),
      emailLength: em.length,
    });
    setLoadBusy(true);
    setSuccessUid(null);
    try {
      const q = new URLSearchParams({
        order: o,
        email: em,
      });
      const res = await fetch(`/api/returns/preview-order?${q.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        lines?: KokobayOrderLine[];
        orderRef?: string;
        error?: string;
        code?: string;
        shopify?: { customerName?: string };
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
        const expired = data.code === "return_window_expired";
        setReturnWindowExpired(expired);
        setOrderLookupError(
          expired
            ? null
            : (data.error ??
                "No lines found for that order. Check the number and try again."),
        );
        setLines(null);
        setOrderRef(null);
        return;
      }
      setOrderLookupError(null);
      setOrderRef(data.orderRef ?? o);
      setOrderInput(data.orderRef ?? o);
      setLines(data.lines);
      const fromShopify = data.shopify?.customerName?.trim() ?? "";
      if (fromShopify && fromShopify !== "—") {
        setName(fromShopify);
      }
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
  }, [orderInput, email]);

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
        returnDeliveryFlow?: "inpost" | "post";
        error?: string;
      };
      if (!res.ok || !data.ok || !data.submissionUid) {
        toast.error(data.error ?? "Could not submit");
        return;
      }
      setSuccessDeliveryFlow(
        data.returnDeliveryFlow === "inpost" ? "inpost" : "post",
      );
      setSuccessUid(data.submissionUid);
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success("Return form submitted", {
        description:
          data.returnDeliveryFlow === "inpost"
            ? "Use InPost to drop off your return."
            : "We’ll email you when we’ve received your parcel.",
      });
    } finally {
      setSubmitBusy(false);
    }
  }, [byLine, datePosted, email, lines, name, orderRef]);

  const displaySuccessUid =
    successUid ?? urlSuccessPreview?.previewUid ?? null;
  const displayDeliveryFlow = successUid
    ? successDeliveryFlow
    : (urlSuccessPreview?.flow ?? "post");
  const isSuccessPreview = urlSuccessPreview != null && successUid == null;

  if (displaySuccessUid) {
    const inPostFlow = displayDeliveryFlow === "inpost";
    return (
      <div className="mx-auto w-full max-w-2xl space-y-5 text-zinc-800 sm:space-y-6 dark:text-zinc-200">
        {isSuccessPreview ? (
          <CustomerReturnSuccessPreviewBanner flow={displayDeliveryFlow} />
        ) : null}
        <div className={SUCCESS_CARD_CLASS} role="status">
          <header className="space-y-3">
            <h2 className="text-[1.375rem] font-medium leading-snug tracking-normal text-zinc-900 sm:text-2xl dark:text-zinc-50">
              Thank you — we’ve received your form
            </h2>
            <p className={`${SUCCESS_BODY_CLASS} text-[0.8125rem] sm:text-sm`}>
              <span className="text-zinc-500 dark:text-zinc-400">Reference </span>
              <span className="break-all font-mono text-[0.75rem] font-medium text-zinc-900 dark:text-zinc-100">
                {displaySuccessUid}
              </span>
            </p>
          </header>
          {inPostFlow ? (
            <div className="mt-8 space-y-6 border-t border-zinc-200/80 pt-8 dark:border-zinc-700/50">
              <div className="space-y-3">
                <h3 className="text-xl font-medium leading-snug tracking-normal text-zinc-900 sm:text-[1.375rem] dark:text-zinc-50">
                  Returns are completed through InPost
                </h3>
                <p className={SUCCESS_BODY_CLASS}>
                  Please click the button below to find your nearest locker and generate
                  a QR code for a quick, easy return.
                </p>
              </div>
              <a
                href={INPOST_RETURNS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={SUCCESS_CTA_CLASS}
              >
                Get started with your InPost return
              </a>
              <p className={`${SUCCESS_BODY_CLASS} pt-1`}>
                We will email you when we have your parcel. Refunds are usually processed
                within{" "}
                <strong className="font-medium text-zinc-900 dark:text-zinc-50">
                  5–10 working days
                </strong>{" "}
                after we receive the items.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-6 border-t border-zinc-200/80 pt-8 dark:border-zinc-700/50">
              <p className={SUCCESS_BODY_CLASS}>
                If you have not posted your return yet, use the address below. We will
                email you when the parcel has arrived. Refunds are usually processed
                within{" "}
                <strong className="font-medium text-zinc-900 dark:text-zinc-50">
                  5–10 working days
                </strong>{" "}
                after we receive the items.
              </p>
              <ParcelSealChecklist variant="success" />
              <div
                className="whitespace-pre-line rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-4 text-[0.8125rem] font-medium leading-relaxed text-zinc-900 shadow-sm sm:px-5 sm:py-5 sm:text-sm dark:border-zinc-700/50 dark:bg-zinc-900/40 dark:text-zinc-100"
                role="group"
                aria-label="Returns address"
              >
                {RETURNS_ADDRESS}
              </div>
            </div>
          )}
        </div>
        {!inPostFlow ? (
          <a href="https://www.kokobay.co.uk" className={SUCCESS_CTA_CLASS}>
            Continue Shopping
          </a>
        ) : null}
      </div>
    );
  }

  const outsideUkInstructions = instructionsRegion === "outsideUk";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 text-zinc-800 sm:space-y-8 dark:text-zinc-200">
      <header>
        <p className="text-sm">
          {outsideUkInstructions ? (
            <button
              type="button"
              onClick={() => setInstructionsRegion("uk")}
              className="font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              Returning from the UK?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setInstructionsRegion("outsideUk")}
              className="font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              Returning from outside UK?
            </button>
          )}
        </p>
        <h1 className="mt-4 text-xl font-semibold tracking-tight sm:mt-5 sm:text-2xl">
          HOW TO RETURN: RETURNS FORM
        </h1>
        <p className="mt-8 text-sm leading-relaxed text-zinc-500 sm:mt-10 mb-12 sm:mb-16">
          {outsideUkInstructions ? (
            <>
              Enter your order number, choose what you are sending back (a reason is
              required for each item), then post to our address. We email you when we have
              your parcel, and we aim to refund within{" "}
              <strong className="font-semibold text-zinc-700 dark:text-zinc-300">
                5–10 working days
              </strong>
              .
            </>
          ) : (
            <>
              Enter your order number, choose what you are sending back (a reason is
              required for each item), then drop off at InPost. We email you when we have
              your parcel, and we aim to refund within{" "}
              <strong className="font-semibold text-zinc-700 dark:text-zinc-300">
                5–10 working days
              </strong>
              .
            </>
          )}
        </p>
      </header>

      {outsideUkInstructions ? (
        <OutsideUkReturnInstructions />
      ) : (
        <UkReturnInstructions />
      )}

      <section className="space-y-3" aria-label="Order lookup">
        <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
          Find your order
        </h2>
        <p className="text-sm text-zinc-500">
          Enter the order number and email from your confirmation; we will show items to
          return.
        </p>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="min-w-0 flex-1 sm:max-w-xs" htmlFor="customer-return-order-input">
            <span className="text-sm font-medium">Order number</span>
            <input
              id="customer-return-order-input"
              value={orderInput}
              onChange={(e) => {
                setOrderInput(e.target.value);
                setOrderLookupError(null);
                setReturnWindowExpired(false);
              }}
              aria-invalid={orderLookupError ? true : undefined}
              aria-describedby={
                orderLookupError ? "customer-return-order-error" : undefined
              }
              className={`mt-1.5 w-full min-h-12 rounded-lg bg-background px-3 py-2.5 text-base text-foreground sm:min-h-10 sm:py-2 sm:text-sm ${
                orderLookupError
                  ? "border-2 border-red-600 outline-none ring-2 ring-red-600/25 focus-visible:ring-red-500/45 dark:border-red-500 dark:ring-red-500/20"
                  : "border border-zinc-300 focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-400/35 dark:border-zinc-600"
              }`}
              autoComplete="off"
            />
          </label>
          <label className="min-w-0 flex-1 sm:max-w-xs" htmlFor="customer-return-lookup-email">
            <span className="text-sm font-medium">Email on the order</span>
            <input
              id="customer-return-lookup-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setOrderLookupError(null);
                setReturnWindowExpired(false);
              }}
              aria-invalid={orderLookupError ? true : undefined}
              aria-describedby={
                orderLookupError ? "customer-return-order-error" : undefined
              }
              autoComplete="email"
              enterKeyHint="search"
              className={`mt-1.5 w-full min-h-12 rounded-lg bg-background px-3 py-2.5 text-base text-foreground sm:min-h-10 sm:py-2 sm:text-sm ${
                orderLookupError
                  ? "border-2 border-red-600 outline-none ring-2 ring-red-600/25 focus-visible:ring-red-500/45 dark:border-red-500 dark:ring-red-500/20"
                  : "border border-zinc-300 focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-400/35 dark:border-zinc-600"
              }`}
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
          {returnWindowExpired ? (
            <div
              role="alert"
              className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm leading-snug text-amber-950 sm:basis-full dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100"
            >
              <p className="font-semibold">Return window closed</p>
              <p className="mt-1.5">{RETURN_WINDOW_EXPIRED_MESSAGE}</p>
            </div>
          ) : orderLookupError ? (
            <p
              id="customer-return-order-error"
              role="alert"
              className="w-full text-sm leading-snug text-red-600 sm:basis-full dark:text-red-400"
            >
              {orderLookupError}
            </p>
          ) : null}
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
