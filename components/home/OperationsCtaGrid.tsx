"use client";

import { ArrowUUpLeft, ListChecks } from "@phosphor-icons/react";
import Link from "next/link";

/**
 * Phosphor icons use React context — this block must be a client component
 * (see `app/page.tsx` server home).
 */
export function OperationsCtaGrid() {
  return (
    <ul className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2 sm:items-stretch">
      <li className="flex h-full min-h-0 flex-col">
        <Link
          href="/picklists"
          className="flex min-h-0 flex-1 flex-row items-stretch gap-3 rounded-xl border-2 border-sky-500/85 bg-gradient-to-b from-sky-50 to-sky-100/80 p-5 shadow-md shadow-sky-900/5 transition-colors hover:border-sky-600 hover:from-sky-100 hover:to-sky-100 dark:border-sky-500/70 dark:from-sky-950/80 dark:to-sky-900/50 dark:shadow-sky-950/40 dark:hover:border-sky-400 dark:hover:from-sky-900/60 dark:hover:to-sky-900/80"
        >
          <ListChecks
            className="h-7 w-7 shrink-0 self-start text-sky-600 dark:text-sky-300"
            weight="duotone"
            aria-hidden
          />
          <div className="min-w-0 flex-1 self-stretch">
            <span className="block text-sm font-semibold text-sky-950 dark:text-sky-100">
              Today’s pick lists
            </span>
            <span className="mt-1 block text-sm text-sky-900/85 dark:text-sky-200/90">
              Standard and UK Premium lists — open the hub
            </span>
          </div>
        </Link>
      </li>
      <li className="flex h-full min-h-0 flex-col">
        <Link
          href="/returns"
          className="flex min-h-0 flex-1 flex-row items-stretch gap-3 rounded-xl border-2 border-orange-500/85 bg-gradient-to-b from-orange-50 to-orange-100/80 p-5 shadow-md shadow-orange-900/5 transition-colors hover:border-orange-600 hover:from-orange-100 hover:to-orange-100 dark:border-orange-500/65 dark:from-orange-950/90 dark:to-orange-900/45 dark:shadow-orange-950/30 dark:hover:border-orange-400 dark:hover:from-orange-900/70 dark:hover:to-orange-900/80"
        >
          <ArrowUUpLeft
            className="h-7 w-7 shrink-0 self-start text-orange-600 dark:text-orange-300"
            weight="duotone"
            aria-hidden
          />
          <div className="min-w-0 flex-1 self-stretch">
            <span className="block text-sm font-semibold text-orange-950 dark:text-orange-100">
              Returns
            </span>
            <span className="mt-1 block text-sm text-orange-900/90 dark:text-orange-200/90">
              Look up an order and process a return
            </span>
          </div>
        </Link>
      </li>
    </ul>
  );
}
