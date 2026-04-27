"use client";

import Link from "next/link";
import { useCallback, useRef } from "react";
import { formatDisplayColour } from "@/lib/formatDisplayColour";
import type { PickListLabelBatchForPrint } from "@/lib/picklistOrderLabelPrintData";

/** Hairline for print; reads lighter on screen so border doesn’t dwarf the type */
const LABEL_OUTLINE =
  "box-border border-[0.5pt] border-black bg-white text-zinc-900 print:border-black print:[-webkit-print-color-adjust:exact] [print-color-adjust:exact]";

const PICK_LIST_DIVIDER =
  "border-b border-b-[0.5pt] border-black text-zinc-800 print:border-black print:[-webkit-print-color-adjust:exact]";

const ORDER_GRID =
  "grid w-full min-w-0 auto-rows-min grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-2";

type Props = {
  backHref: string;
  backLabel: string;
  documentTitle: string;
  pageHeading: string;
  summaryLine: string;
  helpLine: string;
  printBatches: PickListLabelBatchForPrint[];
};

export function PicklistOrderLabelsPrint({
  backHref,
  backLabel,
  documentTitle,
  pageHeading,
  summaryLine,
  helpLine,
  printBatches,
}: Props) {
  const titleBefore = useRef<string | null>(null);
  const onPrint = useCallback(() => {
    titleBefore.current = document.title;
    document.title = documentTitle;
    const onAfter = () => {
      if (titleBefore.current != null) {
        document.title = titleBefore.current;
        titleBefore.current = null;
      }
      globalThis.removeEventListener("afterprint", onAfter);
    };
    globalThis.addEventListener("afterprint", onAfter);
    requestAnimationFrame(() => {
      globalThis.print();
    });
  }, [documentTitle]);

  return (
    <div className="print-root mx-auto w-full max-w-3xl flex-1 p-4 pb-16 sm:p-6 print:max-w-none print:pb-0 print:pt-2">
      <div className="print:hidden">
        <p>
          <Link
            href={backHref}
            className="text-sm font-medium text-foreground underline decoration-zinc-400 underline-offset-2"
          >
            {backLabel}
          </Link>
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          {pageHeading}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {summaryLine}
        </p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
          {helpLine}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onPrint}
            disabled={printBatches.length === 0}
            className="inline-flex items-center justify-center rounded-lg border-2 border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors enabled:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:enabled:hover:bg-white"
          >
            Print…
          </button>
          <span className="text-sm text-zinc-500">
            Browser print. Use a clean layout if your dialog offers it.
          </span>
        </div>
        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Preview
        </h2>
        <p className="text-xs text-zinc-500">
          What prints: one block per order (lines in original order), grouped by
          pick list. ~10mm page margins.{" "}
          <span className="font-medium text-foreground/80">
            Paper uses 40% scale
          </span>{" "}
          in a 2–3 column grid, thin black borders. Preview is full size.
        </p>
      </div>

      <div className="mt-6 print:mt-0">
        {printBatches.length === 0 ? (
          <p
            className="rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-600 print:border-zinc-400"
            data-print-skip-when-empty
          >
            Nothing to print — there are no active pick lists, or all orders
            for this set are already completed.
          </p>
        ) : null}

        <div className="picklist-order-labels-print flex w-full min-w-0 flex-col gap-6 print:gap-4">
          {printBatches.map((batch) => (
            <section
              key={batch.batchIndex}
              className="flex flex-col gap-3 print:gap-2"
            >
              <div
                className={`${PICK_LIST_DIVIDER} w-full pb-2 text-sm font-bold uppercase tracking-wide text-zinc-800 print:pb-1.5 print:text-sm dark:text-zinc-200`}
              >
                Pick list {batch.pickListNumber} · {batch.orders.length} order
                {batch.orders.length === 1 ? "" : "s"}
              </div>
              <div className={ORDER_GRID}>
                {batch.orders.map((order) => (
                <article
                  key={`${batch.batchIndex}-${order.orderNumber}`}
                  className={[
                    "h-full w-full min-w-0 max-w-full rounded p-3 sm:p-4",
                    "break-inside-avoid",
                    "print:rounded-sm print:p-2.5 print:shadow-none",
                    LABEL_OUTLINE,
                  ].join(" ")}
                >
                  <h3 className="font-mono text-xl font-bold leading-tight text-zinc-900 sm:text-2xl print:text-2xl">
                    {order.orderNumber}
                  </h3>
                  {order.lines.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-500">No line items.</p>
                  ) : (
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-800 print:space-y-1.5">
                      {order.lines.map((line) => (
                        <li
                          key={`${order.orderNumber}-L${line.lineIndex}`}
                          className="pl-1 [overflow-wrap:anywhere] print:pl-0.5"
                        >
                          {line.skuDisplay ? (
                            <>
                              <span className="font-mono text-xs sm:text-sm">
                                {line.skuDisplay}
                              </span>
                              <span className="text-zinc-500"> — </span>
                            </>
                          ) : null}
                          <span className="font-semibold tabular-nums">
                            ×{line.quantity}
                          </span>
                          <span className="text-zinc-500"> </span>
                          {line.name}
                          {line.color ? (
                            <span className="text-zinc-500">
                              {" "}
                              · {formatDisplayColour(line.color)}
                            </span>
                          ) : null}
                          {line.size ? (
                            <span className="text-zinc-500"> · {line.size}</span>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  )}
                </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
