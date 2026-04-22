"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { WarehouseLocationLine } from "@/components/WarehouseLocationLine";
import type { OrderAssembly, PickStep } from "@/lib/fetchTodaysPickLists";
import { womensFashionPlaceholderForStep } from "@/lib/picklistPlaceholderImages";

type Props = {
  steps: PickStep[];
  /** Daily pick list number (includes completed work earlier in the day). */
  pickListNumber: number;
  orderNumbers: string[];
  ordersPerList: number;
  dayKey: string;
  assembly: OrderAssembly[];
};

function buildListHref(ordersPerList: number) {
  const p = new URLSearchParams();
  p.set("ordersPerList", String(ordersPerList));
  return `/picklists/today?${p.toString()}`;
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
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/80">
      <Image
        src={src}
        alt={name}
        fill
        className="object-cover"
        sizes="3rem"
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

function AssemblyOrdersList({ orders }: { orders: OrderAssembly[] }) {
  if (orders.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No assembly lines for this list.</p>
    );
  }
  return (
    <ul className="flex flex-col gap-5 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/40 sm:p-5">
      {orders.map((o) => (
        <li key={o.orderNumber}>
          <p className="font-mono text-xs font-semibold text-foreground sm:text-sm">
            {o.orderNumber}
          </p>
          <ol className="mt-1.5 list-decimal pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {o.lines.map((line) => (
              <li
                key={`${o.orderNumber}-${line.lineIndex}`}
                className="pl-0.5"
              >
                <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400 sm:text-sm">
                  {line.sku}
                </span>
                <span className="ml-1.5 tabular-nums font-medium text-foreground">
                  ×{line.quantity}
                </span>
                <span className="ml-1.5 text-zinc-600 dark:text-zinc-400">
                  {line.name}
                </span>
                {line.color ? (
                  <span className="ml-1.5 text-zinc-500">· {line.color}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ul>
  );
}

export function PicklistWalkClient({
  steps,
  pickListNumber,
  orderNumbers,
  ordersPerList,
  dayKey,
  assembly,
}: Props) {
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
  const current = complete ? null : (steps[index] ?? null);
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
            href={buildListHref(ordersPerList)}
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
              <AssemblyOrdersList orders={assembly} />
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
                  href={`/picklists/today/completed?ordersPerList=${ordersPerList}`}
                  className="font-medium text-foreground underline"
                >
                  View completed
                </Link>
                .
              </p>
              <Link
                href={buildListHref(ordersPerList)}
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
            href={buildListHref(ordersPerList)}
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
        <div className="shrink-0 text-right text-xs text-zinc-500">
          <p className="font-medium text-foreground tabular-nums">
            {index + 1} / {n}
          </p>
          <p>stops</p>
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
              <p className="text-xs text-zinc-500">SKU</p>
              <p className="font-mono text-sm font-medium text-foreground sm:text-base">
                {current.sku}
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                {current.name}
              </p>
              {current.color ? (
                <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">
                  <span className="text-xs text-zinc-500">Colour </span>
                  {current.color}
                </p>
              ) : null}
            </div>
            <WalkCurrentProductThumb
              key={`${current.step}-${current.sku}`}
              step={current}
              name={current.name}
              priority={index === 0}
            />
          </div>
          <div>
            <p className="text-xs text-zinc-500">Qty to pick at this stop</p>
            <p className="text-2xl font-extrabold tabular-nums text-foreground sm:text-3xl">
              {current.quantity}
            </p>
          </div>
          {current.forOrders.length > 0 && (
            <p className="text-xs text-zinc-500">
              For:{" "}
              <span className="font-mono text-zinc-600 dark:text-zinc-400">
                {current.forOrders.join(", ")}
              </span>
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
          href={buildListHref(ordersPerList)}
          className="text-sm text-zinc-500 underline"
        >
          View full list
        </Link>
      </p>
    </div>
  );
}
