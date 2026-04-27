"use client";

import { useCallback, useState } from "react";
import type { OrderAssembly } from "@/lib/fetchTodaysPickLists";
import { AssemblyLineText } from "@/components/picklist/AssemblyLineText";
import { AssemblyOrderHeader } from "@/components/picklist/AssemblyOrderHeader";
import { AssemblyLineThumb } from "@/components/picklist/AssemblyLineThumb";

type Props = {
  orders: OrderAssembly[];
  /**
   * Show a **Done** checkbox per order to track packing progress in-session
   * (not persisted). Default: true; set `false` to hide.
   */
  showDoneToggle?: boolean;
  /** e.g. post-pick walk: show product image next to each line. */
  includeThumbnails?: boolean;
  /** CSS classes for the outer `<ul>`. */
  listClassName: string;
  /** CSS classes for each order `<li>` card. */
  orderCardClassName: string;
};

export function AssemblyOrdersPanel({
  orders,
  showDoneToggle = true,
  includeThumbnails = false,
  listClassName,
  orderCardClassName,
}: Props) {
  const [doneKeys, setDoneKeys] = useState<Set<string>>(() => new Set());

  const toggleDone = useCallback((key: string) => {
    setDoneKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  if (orders.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No assembly lines for this list.</p>
    );
  }

  return (
    <ul className={listClassName}>
      {orders.map((o) => {
        const key = o.orderNumber;
        const isDone = doneKeys.has(key);
        const lineCount = o.lines.length;
        const unitCount = o.lines.reduce((s, line) => s + line.quantity, 0);
        const itemsLabel = lineCount === 1 ? "1 item" : `${lineCount} items`;
        const showUnits = unitCount !== lineCount;

        return (
          <li
            key={key}
            className={`${orderCardClassName} ${
              isDone
                ? "bg-emerald-50/50 ring-1 ring-emerald-400/35 dark:bg-emerald-950/30 dark:ring-emerald-600/30"
                : ""
            } transition-[background,box-shadow,opacity] ${isDone ? "opacity-90" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <AssemblyOrderHeader
                  orderNumber={o.orderNumber}
                  customerFirstName={o.customerFirstName}
                  customerLastName={o.customerLastName}
                />
              </div>
              {showDoneToggle && (
                <label className="inline-flex min-h-9 shrink-0 cursor-pointer select-none items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/90 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => toggleDone(key)}
                    className="h-4 w-4 rounded border-zinc-400 text-emerald-600 focus:ring-emerald-500/40 dark:border-zinc-500 dark:text-emerald-500"
                    aria-label={`${isDone ? "Unmark" : "Mark"} order ${o.orderNumber} done`}
                  />
                  <span>Done</span>
                </label>
              )}
            </div>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {itemsLabel}
              {showUnits
                ? ` · ${unitCount} ${unitCount === 1 ? "unit" : "units"}`
                : null}
            </p>
            <ol className="mt-2 list-none space-y-3.5 p-0">
              {o.lines.map((line) => (
                <li key={`${o.orderNumber}-${line.lineIndex}`}>
                  {includeThumbnails ? (
                    <div className="flex gap-3">
                      <div className="shrink-0 pt-0.5">
                        <AssemblyLineThumb
                          orderNumber={o.orderNumber}
                          line={line}
                        />
                      </div>
                      <AssemblyLineText
                        name={line.name}
                        quantity={line.quantity}
                        lineColor={line.color}
                        colorHex={line.colorHex}
                        size={line.size}
                      />
                    </div>
                  ) : (
                    <AssemblyLineText
                      name={line.name}
                      quantity={line.quantity}
                      lineColor={line.color}
                      colorHex={line.colorHex}
                      size={line.size}
                    />
                  )}
                </li>
              ))}
            </ol>
          </li>
        );
      })}
    </ul>
  );
}
