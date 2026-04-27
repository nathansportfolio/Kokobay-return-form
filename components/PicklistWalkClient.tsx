"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WarehouseLocationLine } from "@/components/WarehouseLocationLine";
import {
  type OrderAssembly,
  type PickStep,
  pickStepForOrdersLabel,
} from "@/lib/picklistShared";
import {
  PICKLIST_LIST_KIND_STANDARD,
  type PicklistListKind,
} from "@/lib/picklistListKind";
import { AssemblyOrdersPanel } from "@/components/picklist/AssemblyOrdersPanel";
import { PicklistColorSwatch } from "@/components/picklist/PicklistColorSwatch";
import { womensFashionPlaceholderForStep } from "@/lib/picklistPlaceholderImages";
import { formatKokobaySkuDisplay } from "@/lib/skuDisplay";
import { formatDisplayColour } from "@/lib/formatDisplayColour";
import { isVariantIdPlaceholderSku } from "@/lib/variantIdPlaceholderSku";

type Props = {
  steps: PickStep[];
  /** Daily pick list number (includes completed work earlier in the day). */
  pickListNumber: number;
  orderNumbers: string[];
  ordersPerList: number;
  dayKey: string;
  assembly: OrderAssembly[];
  /** e.g. `/picklists/today` or `/picklists/uk-premium` (no trailing slash). */
  listPathBase?: string;
  listKind?: PicklistListKind;
};

function makeListListHref(ordersPerList: number, listPathBase: string) {
  const p = new URLSearchParams();
  p.set("ordersPerList", String(ordersPerList));
  return `${listPathBase}?${p.toString()}`;
}

function WalkCurrentProductThumb({
  step,
  name,
  priority,
}: {
  step: PickStep;
  name: string;
  priority: boolean;
}) {
  const primary = step.thumbnailImageUrl?.trim();
  const placeholder = womensFashionPlaceholderForStep(step);
  const [usePlaceholder, setUsePlaceholder] = useState(!primary);

  useEffect(() => {
    setUsePlaceholder(!primary);
  }, [primary, step.step, step.sku, step.location]);

  const src = !primary || usePlaceholder ? placeholder : primary;

  return (
    <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/80 sm:h-32 sm:w-32">
      <Image
        src={src}
        alt={name}
        fill
        className="object-cover"
        sizes="(max-width: 640px) 7rem, 8rem"
        priority={priority}
        onError={() => {
          if (primary) setUsePlaceholder(true);
        }}
      />
    </div>
  );
}

function PostPickStatusBar({
  current,
}: {
  current: "assembly" | "assembled" | "packed";
}) {
  const items: { id: "assembly" | "assembled" | "packed"; label: string }[] = [
    { id: "assembly", label: "Assembly" },
    { id: "assembled", label: "Assembled" },
    { id: "packed", label: "Packed" },
  ];
  const currentIdx = items.findIndex((x) => x.id === current);
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="status"
      aria-label={`Status: ${items.find((i) => i.id === current)?.label ?? current}`}
    >
      {items.map((s, i) => {
        const done = i < currentIdx;
        const here = s.id === current;
        return (
          <div key={s.id} className="flex items-center gap-1.5">
            {i > 0 && (
              <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
                /
              </span>
            )}
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                here
                  ? "bg-zinc-900 text-white dark:bg-amber-500 dark:text-amber-950"
                  : done
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800/80 dark:text-zinc-400"
              }`}
            >
              {done ? "✓ " : null}
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function PicklistWalkClient({
  steps,
  pickListNumber,
  orderNumbers,
  ordersPerList,
  dayKey,
  assembly,
  listPathBase: listPathBaseIn,
  listKind: listKindIn,
}: Props) {
  const router = useRouter();
  const listPathBase = listPathBaseIn ?? "/picklists/today";
  const listKind = listKindIn ?? PICKLIST_LIST_KIND_STANDARD;
  const listHref = (n: number) => makeListListHref(n, listPathBase);
  const [index, setIndex] = useState(0);
  const [complete, setComplete] = useState(false);
  const [apiSaved, setApiSaved] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  /** After the pick is saved, walk the user: Assembly → Assembled → Packed. */
  const [postPickPhase, setPostPickPhase] = useState<
    "assembly" | "assembled" | "packed" | null
  >(null);
  const walkSessionStartedAt = useRef<number | null>(null);
  const n = steps.length;

  useEffect(() => {
    // eslint-disable-next-line no-console -- intentional client debug
    console.log("[kokobay picks walk]", {
      dayKey,
      pickListNumber,
      orderNumbers,
      steps,
    });
  }, [dayKey, pickListNumber, orderNumbers, steps]);
  const current = complete ? null : (steps[index] ?? null);
  const currentSkuIsVariantPlaceholder = current
    ? isVariantIdPlaceholderSku(current.sku)
    : false;
  const walkLineColour = current?.color?.trim() ?? "";
  const walkLineSize = current?.size?.trim() ?? "";
  const walkShowColourLine =
    walkLineColour.length > 0 && walkLineColour !== "—";
  const walkShowSize = walkLineSize.length > 0;
  const atStart = !complete && index === 0;
  const atEnd = !complete && index === n - 1;
  const totalItemsQty = steps.reduce((s, st) => s + st.quantity, 0);
  const orderCount = orderNumbers.length;

  useEffect(() => {
    walkSessionStartedAt.current = Date.now();
    return () => {
      walkSessionStartedAt.current = null;
    };
  }, []);

  const goNext = useCallback(async () => {
    if (complete) return;
    if (index < n - 1) {
      setIndex((i) => i + 1);
    } else if (n > 0) {
      if (apiSaved) {
        setComplete(true);
        return;
      }
      setFinishing(true);
      setFinishError(null);
      const t0 = walkSessionStartedAt.current;
      const durationMs =
        t0 != null ? Math.max(0, Date.now() - t0) : 0;
      try {
        const res = await fetch("/api/picklists/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dayKey,
            orderNumbers,
            batchIndex: pickListNumber,
            ordersPerList,
            steps,
            assembly,
            totalItemsQty,
            orderCount,
            durationMs,
            listKind,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          picklistUid?: string;
        };
        if (!res.ok) {
          setFinishError(data.error ?? "Could not mark pick list as complete");
          return;
        }
        setApiSaved(true);
        setPostPickPhase("assembly");
        setComplete(true);
      } finally {
        setFinishing(false);
      }
    }
  }, [
    apiSaved,
    assembly,
    listKind,
    pickListNumber,
    complete,
    dayKey,
    index,
    n,
    orderCount,
    orderNumbers,
    ordersPerList,
    steps,
    totalItemsQty,
  ]);

  const goPrev = useCallback(() => {
    if (complete) {
      if (apiSaved && postPickPhase) {
        if (postPickPhase === "assembled") setPostPickPhase("assembly");
        else if (postPickPhase === "packed") setPostPickPhase("assembled");
        return;
      }
      if (!apiSaved) {
        setComplete(false);
        setIndex(n - 1);
      }
      return;
    }
    if (index > 0) setIndex((i) => i - 1);
  }, [apiSaved, complete, index, n, postPickPhase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        void goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  if (n === 0) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-8 text-center text-sm text-zinc-500">
        No pick steps in this list.
        <div className="mt-4">
          <Link
            href={listHref(ordersPerList)}
            className="font-medium text-foreground underline"
          >
            Back to pick lists
          </Link>
        </div>
      </div>
    );
  }

  if (complete) {
    if (apiSaved && postPickPhase) {
      const phase = postPickPhase;
      return (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-5">
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">
              Pick list {pickListNumber}
            </p>
            <p className="text-xs text-zinc-500">{orderNumbers.join(" · ")}</p>
            <PostPickStatusBar
              current={phase}
            />
          </div>

          {phase === "assembly" && (
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-foreground">
                Order assembly
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Picked. Build each order from its lines in order, then mark as
                assembled.
              </p>
              <AssemblyOrdersPanel
                orders={assembly}
                showDoneToggle
                includeThumbnails
                listClassName="flex flex-col gap-5 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/40 sm:p-5"
                orderCardClassName="rounded-lg border border-dotted border-zinc-300 bg-white/60 p-3 sm:p-4 dark:border-zinc-600 dark:bg-zinc-900/40"
              />
              <button
                type="button"
                onClick={() => setPostPickPhase("assembled")}
                className="min-h-11 w-full rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white dark:bg-amber-500 dark:text-amber-950 sm:max-w-sm sm:self-end"
              >
                Mark as assembled
              </button>
            </div>
          )}

          {phase === "assembled" && (
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-foreground">
                Assembled
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                When every order in this list is built and ready to send, mark it
                packed to finish.
              </p>
              <button
                type="button"
                onClick={() => setPostPickPhase("packed")}
                className="min-h-11 w-full rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white dark:bg-amber-500 dark:text-amber-950 sm:max-w-sm sm:self-end"
              >
                Mark as packed
              </button>
            </div>
          )}

          {phase === "packed" && (
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-foreground">Packed</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                This pick is complete. Orders stay off the active list unless
                undone in{" "}
                <Link
                  href={`${listPathBase}/completed?ordersPerList=${ordersPerList}`}
                  className="font-medium text-foreground underline"
                >
                  View completed
                </Link>
                .
              </p>
              <Link
                href={listHref(ordersPerList)}
                className="inline-flex min-h-11 w-full min-w-0 max-w-sm items-center justify-center rounded-lg border-2 border-zinc-200 bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                Back to all pick lists
              </Link>
            </div>
          )}

          <p className="text-center text-[0.65rem] text-zinc-400 sm:text-left">
            Use ← to go back a step
          </p>
        </div>
      );
    }

    if (!apiSaved) {
      return (
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-4 py-8">
          <p className="text-lg font-semibold text-foreground">
            Pick list {pickListNumber}
          </p>
          <Link
            href={listHref(ordersPerList)}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            Back to all pick lists
          </Link>
          <button
            type="button"
            className="text-sm text-zinc-500 underline"
            onClick={() => {
              walkSessionStartedAt.current = Date.now();
              setComplete(false);
              setIndex(0);
            }}
          >
            Start this list again
          </button>
        </div>
      );
    }
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center py-8 text-sm text-zinc-500">
        One moment…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-4 pb-8">
      {finishError && (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"
          role="alert"
        >
          {finishError}
        </p>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Pick list {pickListNumber}
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            {orderNumbers.join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right text-xs text-zinc-500">
          <p className="font-medium text-foreground tabular-nums">
            {index + 1} / {n}
          </p>
          <p>stops</p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-0.5 text-[11px] font-medium text-sky-700 underline decoration-sky-700/60 hover:text-sky-800 dark:text-sky-400"
          >
            Refresh picks
          </button>
        </div>
      </div>

      <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
        Next to pick
      </p>

      {current && (
        <div className="flex flex-col gap-4 rounded-2xl border-2 border-zinc-200 bg-zinc-50/90 p-4 dark:border-zinc-700 dark:bg-zinc-900/60 sm:p-5">
          <WarehouseLocationLine location={current.location} />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p
                className="text-base font-medium uppercase leading-snug tracking-wide text-foreground sm:text-lg"
                lang="en-GB"
              >
                {current.name}
              </p>
              {(walkShowColourLine || walkShowSize) ? (
                <div className="mt-0.5 flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {walkShowColourLine ? (
                    <p className="flex min-h-[1.25rem] flex-wrap items-center gap-2.5 text-sm leading-snug">
                      <PicklistColorSwatch
                        hex={current.colorHex}
                        className="self-center"
                      />
                      <span>
                        <span className="sr-only">Colour: </span>
                        <span className="text-base font-bold text-foreground">
                          {formatDisplayColour(walkLineColour)}
                        </span>
                      </span>
                    </p>
                  ) : null}
                  {walkShowSize ? (
                    <p
                      className="flex min-h-[1.25rem] flex-wrap items-baseline gap-x-2.5 border-t border-dotted border-zinc-300/95 pt-3 dark:border-zinc-500/60"
                      aria-label={`Size ${walkLineSize}`}
                    >
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Size
                      </span>
                      <span className="text-lg font-bold tabular-nums leading-none text-foreground sm:text-xl">
                        {walkLineSize}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}
              <p
                className={`flex min-h-[1.25rem] flex-wrap items-baseline gap-x-2.5 ${
                  walkShowColourLine || walkShowSize ? "mt-1.5" : "mt-2"
                }`}
              >
                <span
                  className={
                    current.quantity > 1
                      ? "text-xs font-medium uppercase tracking-wide text-red-500 dark:text-red-400"
                      : "text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                  }
                >
                  Qty
                </span>
                <span
                  className={
                    current.quantity > 1
                      ? "text-lg font-bold tabular-nums leading-none text-red-600 sm:text-xl dark:text-red-400"
                      : "text-lg font-bold tabular-nums leading-none text-foreground sm:text-xl"
                  }
                  aria-label={`Quantity to pick at this stop: ${current.quantity}`}
                >
                  {current.quantity}
                </span>
              </p>
            </div>
            <WalkCurrentProductThumb
              key={`${current.step}-${current.sku}`}
              step={current}
              name={current.name}
              priority={index === 0}
            />
          </div>
          {!currentSkuIsVariantPlaceholder ? (
            <div>
              <p className="text-[0.65rem] font-medium uppercase tracking-wider text-zinc-400">
                SKU
              </p>
              <p className="mt-0.5 break-all font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {formatKokobaySkuDisplay(current.sku)}
              </p>
            </div>
          ) : null}
          {current.forOrders.length > 0 && (
            <p className="text-xs text-zinc-500">
              For:{" "}
              <span className="font-mono text-zinc-600 dark:text-zinc-400">
                {pickStepForOrdersLabel(current)}
              </span>
            </p>
          )}
          {(current.sourceLineItemCount ?? 1) > 1 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {current.forOrders.length > 1
                ? `This stop serves ${current.forOrders.length} orders. Pick ${current.quantity} in total.`
                : `Pick ${current.quantity} in total: ${current.sourceLineItemCount ?? 1} product lines share this stop (e.g. top and bottoms) — the name is from the first; assembly has each line.`}
            </p>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:justify-between sm:gap-4">
        <button
          type="button"
          onClick={goPrev}
          disabled={atStart}
          className="order-2 inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-zinc-200 bg-white px-4 text-sm font-semibold text-foreground enabled:hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 enabled:dark:hover:bg-zinc-700 sm:order-1"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => void goNext()}
          disabled={finishing}
          className="order-1 inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-amber-500 dark:text-amber-950 sm:order-2 sm:max-w-xs"
        >
          {finishing
            ? "Saving…"
            : atEnd
              ? "Finish"
              : "Next"}
        </button>
      </div>
      <p className="text-center text-[0.65rem] text-zinc-400">
        Use ← / → or Enter for Next
      </p>

      <p className="pt-2 text-center">
        <Link
          href={listHref(ordersPerList)}
          className="text-sm text-zinc-500 underline"
        >
          View full list
        </Link>
      </p>
    </div>
  );
}
