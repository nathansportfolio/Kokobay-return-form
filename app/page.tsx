import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Warehouse
        </h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
          Picking, returns, and day-to-day operations. Open a section below.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        <li>
          <Link
            href="/orders/today"
            className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
          >
            <span className="text-sm font-semibold text-foreground">
              Today’s orders
            </span>
            <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Lines, units to pick, and totals for the warehouse day
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/picklists/today"
            className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
          >
            <span className="text-sm font-semibold text-foreground">
              Today’s pick lists
            </span>
            <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Five orders per list, stops in efficient walk order
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/picklists"
            className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
          >
            <span className="text-sm font-semibold text-foreground">
              Picklists
            </span>
            <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Hub and links to picking tools
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/floor-map"
            className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
          >
            <span className="text-sm font-semibold text-foreground">
              Floor map
            </span>
            <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Full-page warehouse layout image
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/returns"
            className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
          >
            <span className="text-sm font-semibold text-foreground">
              Returns
            </span>
            <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Look up an order and process a return
            </span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
