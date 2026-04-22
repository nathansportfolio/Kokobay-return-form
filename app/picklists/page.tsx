import type { Metadata } from "next";
import Link from "next/link";

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
          Batched picking for the warehouse day lives on Today’s pick lists.
        </p>
      </div>

      <Link
        href="/picklists/today"
        className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
      >
        <span className="text-sm font-semibold text-foreground">
          Open today’s pick lists
        </span>
        <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Five orders per list, one stop at a time in walk order (row → bin)
        </span>
      </Link>
    </div>
  );
}
