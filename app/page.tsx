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
            href="/picklists/today"
            className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
          >
            <span className="text-sm font-semibold text-foreground">
              Today’s pick lists
            </span>
            <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Shopify lines for today (when configured), walk by location
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
        <li>
          <Link
            href="/orders/shopify"
            className="flex flex-col rounded-xl border border-sky-200 bg-sky-50/90 p-5 transition-colors hover:border-sky-300 hover:bg-sky-100/90 dark:border-sky-900/40 dark:bg-sky-950/30 dark:hover:border-sky-800/60 dark:hover:bg-sky-900/30"
          >
            <span className="text-sm font-semibold text-foreground">
              Shopify orders
            </span>
            <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              All live orders (cached ~1 min), return + admin links
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/orders/today"
            className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
          >
            <span className="text-sm font-semibold text-foreground">
              Today’s orders
            </span>
            <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Today’s Shopify orders for the warehouse (or sample data)
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/picklists"
            className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
          >
            <span className="text-sm font-semibold text-foreground">
              All Picklists
            </span>
            <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Hub and links to picking tools
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/products"
            className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
          >
            <span className="text-sm font-semibold text-foreground">
              Product catalog
            </span>
            <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Live Shopify with warehouse locations from Mongo
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
            href="/returns/form"
            className="flex flex-col rounded-xl border border-amber-200/90 bg-amber-50/90 p-5 transition-colors hover:border-amber-300 hover:bg-amber-100/90 dark:border-amber-800/60 dark:bg-amber-950/30 dark:hover:border-amber-700/80 dark:hover:bg-amber-950/50"
          >
            <span className="text-sm font-semibold text-amber-950 dark:text-amber-200">
              Example form for customers
            </span>
            <span className="mt-1 text-sm text-amber-900/90 dark:text-amber-200/80">
              Order lookup, items, reasons, then post — same flow as the live store
            </span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
