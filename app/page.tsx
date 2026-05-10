import Link from "next/link";
import { OperationsCtaGrid } from "@/components/home/OperationsCtaGrid";
import { getHomepageDashboardStats } from "@/lib/homepageDashboard";
import { formatDayKeyAsOrdinalEnglish } from "@/lib/warehouseLondonDay";

/** Regenerate the dashboard on a short interval (ISR) instead of every request. */
export const revalidate = 20;

function StatFigure({
  ok,
  value,
}: {
  ok: boolean;
  value: number;
}) {
  if (!ok) {
    return <span className="text-2xl font-semibold text-zinc-400">—</span>;
  }
  return (
    <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
      {value}
    </span>
  );
}

function ordersPickedPercent(picked: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((picked * 100) / total));
}

/**
 * Picked / total, optional %, and a progress track for the pick list day.
 */
function OrdersPickedWithProgress({
  ok,
  picked,
  total,
}: {
  ok: boolean;
  picked: number;
  total: number;
}) {
  if (!ok) {
    return <span className="text-2xl font-semibold text-zinc-400">—</span>;
  }
  const pct = ordersPickedPercent(picked, total);
  return (
    <div className="w-full min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span
          className="text-3xl font-bold tabular-nums tracking-tight text-foreground"
          aria-label={`${picked} of ${total} orders picked`}
        >
          {picked}
          <span className="text-foreground/55">/</span>
          {total}
        </span>
        <span
          className="text-sm font-medium tabular-nums text-sky-800 dark:text-sky-200/90"
        >
          {pct}%
          <span className="font-normal text-zinc-500 dark:text-zinc-400"> complete</span>
        </span>
      </div>
      <div
        className="mt-2.5 w-full"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Pick list day progress: orders in a completed pick"
      >
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200/90 dark:bg-zinc-800/80"
        >
          <div
            className="h-full min-w-0 max-w-full rounded-full bg-sky-600 transition-[width] duration-500 ease-out dark:bg-sky-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const stats = await getHomepageDashboardStats();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Warehouse
        </h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
          Picking, returns, and day-to-day operations. Open a section below.
        </p>
        <section className="mt-5">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Today
          </h2>
          <ul
            className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3 sm:items-stretch"
            role="list"
            aria-label="Warehouse summary"
          >
            <li className="flex h-full min-h-0 flex-col">
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-200 border-l-4 border-l-sky-500 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:bg-zinc-900/50 dark:border-l-sky-500/90">
                <span className="text-sm font-semibold text-foreground">
                  Orders picked
                </span>
                <div className="mt-1" aria-live="polite">
                  <OrdersPickedWithProgress
                    ok={stats.orderStatsOk}
                    picked={stats.pickListDayOrdersPicked}
                    total={stats.pickListDayOrderTotal}
                  />
                </div>
                {stats.orderStatsOk && stats.pickListOrderDayKey ? (
                  <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    For{" "}
                    <span className="font-medium text-foreground">
                      {formatDayKeyAsOrdinalEnglish(stats.pickListOrderDayKey)}
                    </span>{" "}
                    (yesterday&apos;s order day)
                  </span>
                ) : (
                  <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    For the pick list order day (yesterday, London)
                  </span>
                )}
                <Link
                  href="/picklists"
                  className="mt-auto self-start pt-3 text-sm font-medium text-sky-800 underline decoration-sky-800/30 underline-offset-2 hover:text-sky-900 dark:text-sky-200 dark:decoration-sky-200/30 dark:hover:text-sky-100"
                >
                  View pick lists →
                </Link>
              </div>
            </li>
            <li className="flex h-full min-h-0 flex-col">
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-200 border-l-4 border-l-violet-500/90 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:border-l-violet-500/80 dark:bg-zinc-900/50">
                <span className="text-sm font-semibold text-foreground">
                  Special deliveries to pick
                </span>
                <span
                  className="mt-1"
                  aria-live="polite"
                  aria-label={
                    stats.ukPremiumSpecialStatsOk
                      ? `${stats.ukPremiumSpecialOrdersYetToPick} special UK Premium orders not yet in a completed pick list`
                      : undefined
                  }
                >
                  <StatFigure
                    ok={stats.ukPremiumSpecialStatsOk}
                    value={stats.ukPremiumSpecialOrdersYetToPick}
                  />
                </span>
                {stats.ukPremiumSpecialStatsOk && stats.ukPremiumOrderDayKey ? (
                  <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium text-foreground">UK Premium</span> (before
                    2pm), {formatDayKeyAsOrdinalEnglish(stats.ukPremiumOrderDayKey)} — not
                    yet picked
                  </span>
                ) : (
                  <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Needs Shopify. UK Premium same-day orders (London) before 2pm.
                  </span>
                )}
                <Link
                  href="/picklists/uk-premium"
                  className="mt-auto self-start pt-3 text-sm font-medium text-violet-800 underline decoration-violet-500/30 underline-offset-2 dark:text-violet-200"
                >
                  Open Next Day →
                </Link>
              </div>
            </li>
            <li className="flex h-full min-h-0 flex-col sm:col-span-2 lg:col-span-1">
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-200 border-l-4 border-l-amber-500/90 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:border-l-amber-500/90 dark:bg-zinc-900/50">
                <span className="text-sm font-semibold text-foreground">
                  Return refunds outstanding
                </span>
                <span className="mt-1" aria-live="polite">
                  <StatFigure
                    ok={stats.returnsCountOk}
                    value={stats.returnsPendingRefund}
                  />
                </span>
                <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Logged in warehouse, full refund not yet marked
                </span>
                <Link
                  href="/returns/logged?refundPending=1"
                  className="mt-auto self-start pt-3 text-sm font-medium text-amber-900 underline decoration-amber-800/30 underline-offset-2 dark:text-amber-200"
                >
                  View →
                </Link>
              </div>
            </li>
          </ul>
        </section>
      </div>

      <div className="flex flex-col gap-10">
        <section>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Operations
          </h2>
          <OperationsCtaGrid />
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Management
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            <li>
              <Link
                href="/warehouse/racks"
                className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
              >
                <span className="text-sm font-semibold text-foreground">
                  Warehouse layout
                </span>
                <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Racks, bays, and levels (bin grid)
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/warehouse/barcodes"
                className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
              >
                <span className="text-sm font-semibold text-foreground">
                  Barcode labels
                </span>
                <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Print bin and product (SKU) labels for a sticker printer
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/sku-maker"
                className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
              >
                <span className="text-sm font-semibold text-foreground">
                  SKU Maker
                </span>
                <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Search any product (drafts included) and generate canonical
                  SKUs per variant — auto-deduped against the whole shop
                </span>
              </Link>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Resources
          </h2>
          <ul className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2 sm:items-stretch">
            <li className="flex h-full min-h-0 flex-col">
              <Link
                href="/orders/today"
                className="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
              >
                <span className="text-sm font-semibold text-foreground">
                  Today’s orders
                </span>
                <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Live Shopify for the warehouse day (or sample from Mongo)
                </span>
              </Link>
            </li>
            <li className="flex h-full min-h-0 flex-col">
              <Link
                href="/picklists"
                className="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
              >
                <span className="text-sm font-semibold text-foreground">
                  All Picklists
                </span>
                <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Hub and links to picking tools
                </span>
              </Link>
            </li>
            <li className="flex h-full min-h-0 flex-col">
              <Link
                href="/products"
                className="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
              >
                <span className="text-sm font-semibold text-foreground">
                  Product catalog
                </span>
                <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Live Shopify with warehouse locations from Mongo
                </span>
              </Link>
            </li>
            <li className="flex h-full min-h-0 flex-col">
              <Link
                href="/floor-map"
                className="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
              >
                <span className="text-sm font-semibold text-foreground">
                  Floor map
                </span>
                <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Full-page warehouse layout image
                </span>
              </Link>
            </li>
            <li className="flex h-full min-h-0 flex-col">
              <Link
                href="/racking-map"
                className="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
              >
                <span className="text-sm font-semibold text-foreground">
                  Racking map
                </span>
                <span className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Full-page rack, bay, and level guide (image)
                </span>
              </Link>
            </li>
            <li className="flex h-full min-h-0 flex-col">
              <Link
                href="/returns/form"
                className="flex min-h-0 flex-1 flex-col rounded-xl border border-amber-200/90 bg-amber-50/90 p-5 transition-colors hover:border-amber-300 hover:bg-amber-100/90 dark:border-amber-800/60 dark:bg-amber-950/30 dark:hover:border-amber-700/80 dark:hover:bg-amber-950/50"
              >
                <span className="text-sm font-semibold text-amber-950 dark:text-amber-200">
                  Example form for customers
                </span>
                <span className="mt-1 text-sm text-amber-900/90 dark:text-amber-200/80">
                  Order lookup, items, reasons, then post — same flow as the live
                  store
                </span>
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
