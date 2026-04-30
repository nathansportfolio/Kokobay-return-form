import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

/** No live data: links only — can be prerendered and cached. */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Picklists",
  description: "Warehouse picklists",
};

const HUB_THUMB_STANDARD =
  "https://images.unsplash.com/photo-1504194104404-43360c07e3f2?w=256&h=256&fit=crop&q=80";
const HUB_THUMB_NEXT_DAY =
  "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=256&h=256&fit=crop&q=80";

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
            className="flex flex-row gap-4 rounded-xl border border-sky-200/90 bg-sky-50/80 p-5 transition-colors hover:border-sky-300 hover:bg-sky-100/90 dark:border-sky-800/80 dark:bg-sky-950/40 dark:hover:border-sky-700 dark:hover:bg-sky-900/50"
          >
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-sky-200/80 bg-sky-100/80 dark:border-sky-800/60 dark:bg-sky-900/40 sm:h-24 sm:w-24">
              <Image
                src={HUB_THUMB_STANDARD}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 640px) 5rem, 6rem"
              />
            </div>
            <div className="min-w-0 flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                Today’s pick lists (standard)
              </span>
              <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Yesterday’s London order day, batched by walk order: aisle → bay
                → shelf → bin
              </span>
            </div>
          </Link>
        </li>
        <li>
          <Link
            href="/picklists/uk-premium"
            className="flex flex-row gap-4 rounded-xl border border-amber-200/90 bg-amber-50/80 p-5 transition-colors hover:border-amber-300 hover:bg-amber-100/90 dark:border-amber-900/70 dark:bg-amber-950/35 dark:hover:border-amber-700 dark:hover:bg-amber-900/40"
          >
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-amber-200/80 bg-amber-100/80 dark:border-amber-800/50 dark:bg-amber-900/30 sm:h-24 sm:w-24">
              <Image
                src={HUB_THUMB_NEXT_DAY}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 640px) 5rem, 6rem"
              />
            </div>
            <div className="min-w-0 flex flex-col">
              <span className="text-sm font-semibold text-foreground">Next Day</span>
              <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                <span className="font-medium text-foreground">
                  UK Premium Delivery (1–2 working days)
                </span>{" "}
                — same London day, order placed before 2pm
              </span>
            </div>
          </Link>
        </li>
      </ul>
    </div>
  );
}
