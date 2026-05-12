"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WarehouseLocationLine } from "@/components/WarehouseLocationLine";
import {
  type OrderAssembly,
  type OrderForPick,
  type PickStep,
  pickStepForOrdersLabel,
} from "@/lib/picklistShared";
import {
  buildAssemblyFromOrders,
  buildSortedStepsFromOrders,
} from "@/lib/picklistStepsFromOrders";
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
  /** Full batch (same as list); required to drop one order and rebuild steps mid-walk. */
  batchOrders: OrderForPick[];
  ordersPerList: number;
  itemsPerList: number;
  dayKey: string;
  assembly: OrderAssembly[];
  /** e.g. `/picklists/today` or `/picklists/uk-premium` (no trailing slash). */
  listPathBase?: string;
  listKind?: PicklistListKind;
};

function makeListListHref(
  ordersPerList: number,
  itemsPerList: number,
  listPathBase: string,
) {
  const p = new URLSearchParams();
  p.set("ordersPerList", String(ordersPerList));
  p.set("itemsPerList", String(itemsPerList));
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

function mergeReturnBinsByOrder(
  hints: { orderNumber: string; returnToLocations: string[] }[],
): { orderNumber: string; returnToLocations: string[] }[] {
  const m = new Map<string, Set<string>>();
  for (const h of hints) {
    const set = m.get(h.orderNumber) ?? new Set<string>();
    for (const loc of h.returnToLocations ?? []) {
      const t = String(loc).trim();
      if (t) set.add(t);
    }
    m.set(h.orderNumber, set);
  }
  return [...m.entries()]
    .map(([orderNumber, set]) => ({
      orderNumber,
      returnToLocations: [...set].sort(),
    }))
    .sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));
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
  steps: initialSteps,
  pickListNumber,
  orderNumbers: initialOrderNumbers,
  batchOrders,
  ordersPerList,
  itemsPerList,
  dayKey,
  assembly: initialAssembly,
  listPathBase: listPathBaseIn,
  listKind: listKindIn,
}: Props) {
  const router = useRouter();
  const listPathBase = listPathBaseIn ?? "/picklists/today";
  const listKind = listKindIn ?? PICKLIST_LIST_KIND_STANDARD;
  const listHref = (o: number, it: number) => makeListListHref(o, it, listPathBase);
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
  const [walkSteps, setWalkSteps] = useState(initialSteps);
  const [walkOrderNumbers, setWalkOrderNumbers] = useState(initialOrderNumbers);
  const [walkAssembly, setWalkAssembly] = useState(initialAssembly);
  const [excludedPauseOrders, setExcludedPauseOrders] = useState<string[]>([]);
  const [sessionPauseHints, setSessionPauseHints] = useState<
    { orderNumber: string; returnToLocations: string[] }[]
  >([]);
  const [pauseToast, setPauseToast] = useState<string | null>(null);
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
  const [skipWorking, setSkipWorking] = useState(false);
  const [skipError, setSkipError] = useState<string | null>(null);
  const [selectedPauseOrder, setSelectedPauseOrder] = useState<string | null>(
    null,
  );

  const n = walkSteps.length;
  useEffect(() => {
    // eslint-disable-next-line no-console -- intentional client debug
    console.log("[kokobay picks walk]", {
      dayKey,
      pickListNumber,
      walkOrderNumbers,
      walkSteps,
      excludedPauseOrders,
    });
  }, [dayKey, excludedPauseOrders, pickListNumber, walkOrderNumbers, walkSteps]);
  const current = complete ? null : (walkSteps[index] ?? null);
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
  const totalItemsQty = walkSteps.reduce((s, st) => s + st.quantity, 0);
  const orderCount = walkOrderNumbers.length;

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
            orderNumbers: walkOrderNumbers,
            batchIndex: pickListNumber,
            ordersPerList,
            itemsPerList,
            steps: walkSteps,
            assembly: walkAssembly,
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
    walkAssembly,
    listKind,
    pickListNumber,
    complete,
    dayKey,
    index,
    n,
    orderCount,
    walkOrderNumbers,
    ordersPerList,
    itemsPerList,
    walkSteps,
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
        setIndex(Math.max(0, walkSteps.length - 1));
      }
      return;
    }
    if (index > 0) setIndex((i) => i - 1);
  }, [apiSaved, complete, index, n, postPickPhase, walkSteps.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (skipConfirmOpen) return;
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
  }, [goNext, goPrev, skipConfirmOpen]);

  if (n === 0) {
    const allPaused =
      batchOrders.length > 0 && excludedPauseOrders.length === batchOrders.length;
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-8 text-center text-sm text-zinc-500">
        {allPaused ? (
          <>
            <p className="font-medium text-foreground">
              Every order on this list was paused for missing stock.
            </p>
            <p className="mt-2">
              Nothing left to pick here. Use{" "}
              <Link
                href={`${listPathBase}/missing-stock`}
                className="text-foreground underline"
              >
                Missing stock
              </Link>{" "}
              for return hints, then go back when holds are cleared.
            </p>
          </>
        ) : (
          <p>No pick steps in this list.</p>
        )}
        <div className="mt-4">
          <Link
            href={listHref(ordersPerList, itemsPerList)}
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
            <p className="text-xs text-zinc-500">{walkOrderNumbers.join(" · ")}</p>
            {excludedPauseOrders.length > 0 ? (
              <p className="text-xs font-medium text-amber-900 dark:text-amber-200/90">
                Paused this walk (missing stock):{" "}
                <span className="font-mono">{excludedPauseOrders.join(" · ")}</span>
              </p>
            ) : null}
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
                Picked for the orders still on this list. Build each from its
                lines, then mark assembled. For any order paused during the walk,
                return picked units to the bins below, then handle the hold on{" "}
                <Link
                  href={`${listPathBase}/missing-stock`}
                  className="font-medium text-foreground underline"
                >
                  Missing stock
                </Link>
                .
              </p>
              {mergeReturnBinsByOrder(sessionPauseHints).length > 0 ? (
                <div className="rounded-xl border border-amber-300/90 bg-amber-50/90 p-4 text-sm dark:border-amber-800/70 dark:bg-amber-950/40">
                  <p className="font-semibold text-amber-950 dark:text-amber-100">
                    Paused orders — put picked stock back in these bins
                  </p>
                  <ul className="mt-3 list-none space-y-3 p-0">
                    {mergeReturnBinsByOrder(sessionPauseHints).map((h) => (
                      <li key={h.orderNumber}>
                        <p className="font-mono text-xs font-semibold text-foreground">
                          {h.orderNumber}
                        </p>
                        {h.returnToLocations.length > 0 ? (
                          <ol className="mt-1 list-decimal pl-5 text-xs text-zinc-800 dark:text-zinc-200">
                            {h.returnToLocations.map((loc) => (
                              <li key={`${h.orderNumber}-${loc}`}>
                                <span className="font-mono">{loc}</span>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                            No earlier bins on this walk (pause was at the first
                            stop).
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <AssemblyOrdersPanel
                orders={walkAssembly}
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
                  href={`${listPathBase}/completed?ordersPerList=${ordersPerList}&itemsPerList=${itemsPerList}`}
                  className="font-medium text-foreground underline"
                >
                  View completed
                </Link>
                .
              </p>
              <Link
                href={listHref(ordersPerList, itemsPerList)}
                onClick={() => router.refresh()}
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
            href={listHref(ordersPerList, itemsPerList)}
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
      {pauseToast ? (
        <p
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800/80 dark:bg-emerald-950/50 dark:text-emerald-100"
          role="status"
        >
          {pauseToast}
        </p>
      ) : null}
      {skipError ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"
          role="alert"
        >
          {skipError}
        </p>
      ) : null}
      {skipConfirmOpen && current && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="skip-dialog-title"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2
              id="skip-dialog-title"
              className="text-base font-semibold text-foreground"
            >
              Pause one order — no stock at this bin?
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Only the order you choose is paused and dropped from{" "}
              <span className="font-medium text-foreground">this</span> walk. The
              rest of the pick continues with updated quantities. That order stays
              off future pick lists until you clear the hold on Missing stock.
            </p>
            <p className="mt-2 text-xs text-amber-900/95 dark:text-amber-200/85">
              Do not refresh this page mid-walk — your batch is frozen in the
              browser until you finish.
            </p>
            <p className="mt-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
              Stop covers: {pickStepForOrdersLabel(current)}
            </p>
            <p className="mt-3 text-xs text-zinc-500">
              Bin:{" "}
              <span className="font-mono text-zinc-700 dark:text-zinc-300">
                {current.location}
              </span>{" "}
              · SKU{" "}
              <span className="font-mono text-zinc-700 dark:text-zinc-300">
                {formatKokobaySkuDisplay(current.sku)}
              </span>
            </p>
            {current.forOrders.length > 1 ? (
              <fieldset className="mt-4 space-y-2">
                <legend className="text-xs font-semibold text-foreground">
                  Which order is short at this bin?
                </legend>
                {current.forOrders.map((on) => (
                  <label
                    key={on}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/90 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800/80"
                  >
                    <input
                      type="radio"
                      name="pause-order"
                      checked={selectedPauseOrder === on}
                      onChange={() => setSelectedPauseOrder(on)}
                      className="h-4 w-4 border-zinc-400 text-amber-600"
                    />
                    <span className="font-mono text-xs">{on}</span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
                Order:{" "}
                <span className="font-mono font-medium text-foreground">
                  {current.forOrders[0]}
                </span>
              </p>
            )}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={skipWorking}
                onClick={() => {
                  setSkipConfirmOpen(false);
                  setSkipError(null);
                }}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 px-4 text-sm font-medium text-foreground dark:border-zinc-600 dark:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  skipWorking ||
                  !selectedPauseOrder ||
                  !current.forOrders.includes(selectedPauseOrder)
                }
                onClick={async () => {
                  const step = walkSteps[index];
                  const toPause = selectedPauseOrder;
                  if (!step || !toPause || !step.forOrders.includes(toPause)) {
                    setSkipError("Choose an order on this stop");
                    return;
                  }
                  setSkipWorking(true);
                  setSkipError(null);
                  try {
                    const res = await fetch("/api/picklists/pause-missing-stock", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        dayKey,
                        listKind,
                        affectedOrderNumbers: [toPause],
                        steps: walkSteps,
                        currentStepIndex: index,
                        currentStep: step,
                      }),
                    });
                    const data = (await res.json().catch(() => ({}))) as {
                      ok?: boolean;
                      error?: string;
                      returnHints?: {
                        orderNumber: string;
                        returnToLocations: string[];
                      }[];
                    };
                    if (!res.ok || !data.ok) {
                      setSkipError(data.error ?? "Could not pause order");
                      return;
                    }
                    const nextExcluded = [...excludedPauseOrders, toPause];
                    const remaining = batchOrders.filter(
                      (o) => !nextExcluded.includes(o.orderNumber),
                    );
                    const newSteps = buildSortedStepsFromOrders(remaining);
                    const newAssembly = buildAssemblyFromOrders(remaining);
                    let nextIdx = 0;
                    if (newSteps.length > 0) {
                      const ni = newSteps.findIndex(
                        (s) =>
                          s.location === step.location && s.sku === step.sku,
                      );
                      nextIdx =
                        ni >= 0
                          ? ni
                          : Math.min(index, newSteps.length - 1);
                    }
                    setExcludedPauseOrders(nextExcluded);
                    setWalkSteps(newSteps);
                    setWalkAssembly(newAssembly);
                    setWalkOrderNumbers(remaining.map((o) => o.orderNumber));
                    setIndex(Math.max(0, nextIdx));
                    setSessionPauseHints((p) => [
                      ...p,
                      ...(Array.isArray(data.returnHints)
                        ? data.returnHints
                        : []),
                    ]);
                    setSkipConfirmOpen(false);
                    setPauseToast(
                      `Order ${toPause} paused — pick continues for the other orders.`,
                    );
                    window.setTimeout(() => setPauseToast(null), 6500);
                  } finally {
                    setSkipWorking(false);
                  }
                }}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400"
              >
                {skipWorking ? "Pausing…" : "Confirm pause"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Pick list {pickListNumber}
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            {walkOrderNumbers.join(" · ")}
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
      {current && current.forOrders.length > 0 && (
        <button
          type="button"
          disabled={skipWorking || finishing}
          onClick={() => {
            setSkipError(null);
            const fo = current.forOrders;
            setSelectedPauseOrder(
              fo.length === 1 ? fo[0]! : fo[0] ?? null,
            );
            setSkipConfirmOpen(true);
          }}
          className="text-center text-sm font-medium text-amber-800 underline decoration-amber-700/40 underline-offset-2 hover:text-amber-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-300 dark:decoration-amber-400/40 dark:hover:text-amber-200"
        >
          Pause 1 order — no stock at this bin (pick continues)
        </button>
      )}
      <p className="text-center text-[0.65rem] text-zinc-400">
        Use ← / → or Enter for Next
      </p>

      <p className="pt-2 text-center">
        <Link
          href={listHref(ordersPerList, itemsPerList)}
          className="text-sm text-zinc-500 underline"
        >
          View full list
        </Link>
      </p>
    </div>
  );
}
