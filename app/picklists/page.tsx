import type { Metadata } from "next";
import Link from "next/link";

/** No live data: links only — can be prerendered and cached. */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Picklists",
  description: "Warehouse picklists",
};

export default function PicklistsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Picklists
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Standard picks use the prior London order day. UK Premium (next-day)
          picks the same work day, before 2pm.
        </p>
      </div>

      <ul className="grid list-none gap-3 p-0 sm:grid-cols-1">
        <li>
          <Link
            href="/picklists/today"
            className="block rounded-xl border border-sky-200/90 bg-sky-50/80 p-5 transition-colors hover:border-sky-300 hover:bg-sky-100/90 dark:border-sky-800/80 dark:bg-sky-950/40 dark:hover:border-sky-700 dark:hover:bg-sky-900/50"
          >
            <span className="text-sm font-semibold text-foreground">
              Today’s pick lists (standard)
            </span>
            <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">
              Yesterday’s London order day, batched by walk order: aisle → bay →
              shelf → bin
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/picklists/uk-premium"
            className="block rounded-xl border border-amber-200/90 bg-amber-50/80 p-5 transition-colors hover:border-amber-300 hover:bg-amber-100/90 dark:border-amber-900/70 dark:bg-amber-950/35 dark:hover:border-amber-700 dark:hover:bg-amber-900/40"
          >
            <span className="text-sm font-semibold text-foreground">Next Day</span>
            <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-medium text-foreground">
                UK Premium Delivery (1–2 working days)
              </span>{" "}
              — same London day, order placed before 2pm
            </span>
          </Link>
        </li>
        <li>
          <div className="flex flex-row gap-4 rounded-xl border border-amber-200/90 bg-amber-50/70 p-5 dark:border-amber-900/60 dark:bg-amber-950/30">
            <div className="min-w-0 flex flex-col gap-2">
              <span className="text-sm font-semibold text-foreground">
                Missing stock (holds)
              </span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Orders paused when a bin was empty. Clear holds here when stock
                is back so those orders rejoin the active queue.
              </span>
              <div className="flex flex-wrap gap-3 text-sm font-medium">
                <Link
                  href="/picklists/today/missing-stock"
                  className="text-amber-950 underline decoration-amber-800/40 underline-offset-2 dark:text-amber-100"
                >
                  Standard holds
                </Link>
                <Link
                  href="/picklists/uk-premium/missing-stock"
                  className="text-amber-950 underline decoration-amber-800/40 underline-offset-2 dark:text-amber-100"
                >
                  Next Day holds
                </Link>
              </div>
            </div>
          </div>
        </li>
        <li>
          <Link
            href="/warehouse/pick-speed-test"
            className="flex flex-row gap-4 rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950/40 dark:hover:border-zinc-600 dark:hover:bg-zinc-900/50"
          >
            <div className="min-w-0 flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                Pick speed test (training)
              </span>
              <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Compare one-by-one vs batched pick walk on the same Shopify
                orders. Does not save completed picklists.
              </span>
            </div>
          </Link>
        </li>
      </ul>
    </div>
  );
}
