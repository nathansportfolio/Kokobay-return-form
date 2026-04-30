import type { ReturnLineDisposition } from "@/lib/returnLogTypes";
import { normalizeReturnLineDisposition } from "@/lib/returnLogTypes";

/**
 * Selected-state colours for warehouse handling — keep in sync with
 * `OrderReturnLines` disposition radios.
 */
export const RETURN_LINE_DISPOSITION_SELECTED_TONE: Record<
  ReturnLineDisposition,
  string
> = {
  restock:
    "border-emerald-500 bg-emerald-50 font-medium text-emerald-900 ring-1 ring-emerald-500/45 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-500/35",
  dispose:
    "border-red-500 bg-red-50 font-medium text-red-900 ring-1 ring-red-500/45 dark:border-red-500 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-500/35",
  return_to_sender:
    "border-sky-500 bg-sky-50 font-medium text-sky-950 ring-1 ring-sky-500/45 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-100 dark:ring-sky-500/35",
  wrong_item_received:
    "border-violet-500 bg-violet-50 font-medium text-violet-950 ring-1 ring-violet-500/45 dark:border-violet-500 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-500/35",
};

/** Left border on stacked line rows (logged lists). */
export function returnLineDispositionListBorderClass(
  disposition: unknown,
): string {
  const d = normalizeReturnLineDisposition(disposition);
  switch (d) {
    case "restock":
      return "border-emerald-500 dark:border-emerald-500";
    case "dispose":
      return "border-red-500 dark:border-red-500";
    case "return_to_sender":
      return "border-sky-500 dark:border-sky-500";
    case "wrong_item_received":
      return "border-violet-500 dark:border-violet-500";
  }
}

/** Compact pill for “Handling” on refund / logged lists. */
export function returnLineDispositionHandlingPillClass(
  disposition: unknown,
  greyed: boolean,
): string {
  const d = normalizeReturnLineDisposition(disposition);
  const tone = RETURN_LINE_DISPOSITION_SELECTED_TONE[d];
  const shell =
    "inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-xs font-semibold";
  if (greyed) {
    return `${shell} ${tone} opacity-[0.72] saturate-[0.85]`;
  }
  return `${shell} ${tone}`;
}
