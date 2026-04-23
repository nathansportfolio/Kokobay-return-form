import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PicklistHowToFindProductsButton } from "@/components/PicklistHowToFindProductsButton";
import { PicklistMarkCompleteButton } from "@/components/PicklistMarkCompleteButton";
import { PicklistOrdersPerListSelect } from "@/components/PicklistOrdersPerListSelect";
import { WarehouseLocationLine } from "@/components/WarehouseLocationLine";
import { fetchTodaysPickLists, parseOrdersPerListParam } from "@/lib/fetchTodaysPickLists";
import { formatKokobaySkuDisplay } from "@/lib/skuDisplay";
import { isVariantIdPlaceholderSku } from "@/lib/variantIdPlaceholderSku";
import {
  PICK_LIST_TB_ACTION,
  PICK_LIST_TB_PRINT_TODAY,
  PICK_LIST_TB_SECONDARY,
  PICK_LIST_TOOLBAR_WRAP,
} from "@/components/picklist/pickListToolbarClasses";
import { formatDayKeyAsOrdinalEnglish } from "@/lib/warehouseLondonDay";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Today’s pick lists",
  description: "Batched pick walks: orders from the previous warehouse day (London), picked today",
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TodaysPickListsPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const ordersPerList = parseOrdersPerListParam(sp.ordersPerList);

  let payload: Awaited<ReturnType<typeof fetchTodaysPickLists>>;
  try {
    payload = await fetchTodaysPickLists(ordersPerList);
  } catch {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Today’s pick lists
        </h1>
        <p className="text-sm text-red-600 dark:text-red-400">
          Could not load pick lists. If you use Shopify, check{" "}
          <code className="font-mono">SHOPIFY_</code> env vars. Otherwise
          check MongoDB for sample orders.
        </p>
      </div>
    );
  }

  const {
    dayKey,
    batches,
    ordersPerList: appliedOrdersPerList,
    totalPicklistsForDay,
    completedPicklistCount,
    dataSource,
  } = payload;
  const completedQuery = new URLSearchParams();
  completedQuery.set("ordersPerList", String(appliedOrdersPerList));
  const printQuery = new URLSearchParams();
  printQuery.set("ordersPerList", String(appliedOrdersPerList));
  const showProgress =
    totalPicklistsForDay > 0 || completedPicklistCount > 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-4 pb-12 sm:p-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col gap-2.5">
          <h1 className="min-w-0 text-2xl font-semibold leading-tight tracking-tight text-foreground">
            Today’s pick lists
          </h1>
          <div className={PICK_LIST_TOOLBAR_WRAP}>
            <PicklistHowToFindProductsButton />
            <Link
              href="/picklists"
              className={`${PICK_LIST_TB_ACTION} ${PICK_LIST_TB_SECONDARY}`}
            >
              All types
            </Link>
            <Link
              href={`/picklists/today/completed?${completedQuery.toString()}`}
              className={`${PICK_LIST_TB_ACTION} ${PICK_LIST_TB_SECONDARY}`}
            >
              View completed
            </Link>
            <Link
              href={`/picklists/today/print?${printQuery.toString()}`}
              className={`${PICK_LIST_TB_ACTION} ${PICK_LIST_TB_PRINT_TODAY}`}
            >
              Print all order labels
            </Link>
          </div>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-foreground">Order day (London):</span>{" "}
          <span className="text-foreground">
            {formatDayKeyAsOrdinalEnglish(dayKey)}
          </span>
          . Picks are <span className="font-medium text-foreground">yesterday’s orders</span> (ship
          today, pick the prior calendar day in the warehouse).{" "}
          <Link className="underline" href="/orders/today">
            Today’s orders
          </Link>{" "}
          (same Shopify store) is the <span className="font-medium">current</span> warehouse day.
        </p>
        {dataSource === "shopify" ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-foreground">Shopify</span> — bin and walk order use{" "}
            <span className="text-foreground">mock location codes</span> for now. Thumbnails and
            colour may come from <code className="text-xs">products</code> in Mongo when the SKU
            exists.
          </p>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-foreground">Sample Mongo</span> <code>orders</code>{" "}
            for that order day only.
          </p>
        )}
        {showProgress && (
          <p
            className="text-sm text-zinc-600 dark:text-zinc-400"
            aria-label={`${completedPicklistCount} of ${totalPicklistsForDay} pick lists complete`}
          >
            <span className="font-semibold tabular-nums text-foreground">
              {completedPicklistCount}/{totalPicklistsForDay}
            </span>{" "}
            pick list{totalPicklistsForDay === 1 ? "" : "s"} complete
          </p>
        )}
        <div className="flex w-full min-w-0 sm:justify-end">
          <Suspense
            fallback={
              <div
                className="h-9 w-40 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800"
                aria-hidden
              />
            }
          >
            <PicklistOrdersPerListSelect value={appliedOrdersPerList} />
          </Suspense>
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/50">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            No orders to pick today
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {dataSource === "shopify" ? (
              <>
                No Shopify line items to pick for the warehouse day, or
                all are already in completed pick lists. See{" "}
                <Link
                  className="font-medium text-foreground underline"
                  href="/orders/today"
                >
                  Today’s orders
                </Link>{" "}
                for the same set.
              </>
            ) : (
              <>
                Pick lists follow the same day as{" "}
                <span className="font-medium text-foreground">Today’s orders</span>{" "}
                (sample Mongo <code>orders</code>).
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {batches.map((batch) => {
            const totalItemsQty = batch.steps.reduce(
              (sum, step) => sum + step.quantity,
              0,
            );
            const orderCount = batch.orderNumbers.length;
            return (
            <section
              key={batch.batchIndex}
              className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    Pick list {batch.displayPickListNumber}
                  </h2>
                  <Link
                    href={`/picklists/today/walk?list=${batch.batchIndex}&ordersPerList=${appliedOrdersPerList}`}
                    className="shrink-0 rounded-lg border-2 border-sky-600/80 bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:border-sky-700 hover:bg-sky-700 dark:border-sky-500 dark:bg-sky-600 dark:hover:border-sky-400 dark:hover:bg-sky-500"
                  >
                    Start Picklist
                  </Link>
                </div>
                <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    Orders ({batch.orderNumbers.length}):
                  </span>{" "}
                  <span className="font-mono text-zinc-800 dark:text-zinc-200">
                    {batch.orderNumbers.join(", ")}
                  </span>
                </p>
              </div>

              <ol className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {batch.steps.map((s) => (
                  <li
                    key={`${batch.batchIndex}-${s.step}`}
                    className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                      aria-hidden
                    >
                      {s.step}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <WarehouseLocationLine location={s.location} />
                          {!isVariantIdPlaceholderSku(s.sku) ? (
                            <p className="mt-1.5 min-w-0 break-all font-mono text-xs text-zinc-500 sm:text-sm">
                              <span className="text-zinc-500 dark:text-zinc-400">
                                SKU:{" "}
                              </span>
                              <span className="font-medium text-foreground">
                                {formatKokobaySkuDisplay(s.sku)}
                              </span>
                            </p>
                          ) : null}
                          <p className="mt-1.5 text-sm leading-snug text-zinc-700 dark:text-zinc-300">
                            {s.name}
                          </p>
                          {s.color ? (
                            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                              <span className="text-zinc-500">Colour: </span>
                              {s.color}
                            </p>
                          ) : null}
                          <p className="mt-1.5 text-xs text-zinc-500">
                            For:{" "}
                            <span className="font-mono text-zinc-600 dark:text-zinc-400">
                              {s.forOrders.join(", ")}
                            </span>
                          </p>
                        </div>
                        <div
                          className="flex shrink-0 flex-col items-center gap-0.5 rounded-md border-2 border-zinc-900 bg-zinc-900 px-2 py-1.5 text-center dark:border-amber-500/90 dark:bg-amber-500"
                          title={`Pick ${s.quantity} unit${s.quantity === 1 ? "" : "s"} at this stop`}
                        >
                          <span className="text-[0.5rem] font-extrabold uppercase leading-none tracking-[0.15em] text-white/85">
                            Qty
                          </span>
                          <span className="text-xl font-extrabold leading-none tabular-nums text-white sm:text-2xl">
                            {s.quantity}
                          </span>
                          <span className="text-[0.6rem] font-medium leading-tight text-white/80">
                            unit
                            {s.quantity === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/90 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50 sm:px-5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Orders on this list
                  </span>
                  <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-sm font-extrabold tabular-nums text-foreground dark:border-zinc-600 dark:bg-zinc-800 sm:text-base">
                    {orderCount}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                  <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Total items (qty)
                  </span>
                  <span className="inline-flex min-w-[3.25rem] items-center justify-center rounded-md border-2 border-zinc-900 bg-zinc-900 px-2.5 py-1 text-lg font-extrabold tabular-nums text-white dark:border-amber-500/90 dark:bg-amber-500 sm:text-xl">
                    {totalItemsQty}
                  </span>
                </div>
              </div>

              <div className="border-t border-dashed border-zinc-200 px-4 py-4 dark:border-zinc-700 sm:px-5">
                <h3 className="text-sm font-semibold text-foreground">
                  Order Assembly
                </h3>
                <ul className="mt-3 flex flex-col gap-4">
                  {batch.assembly.map((o) => (
                    <li key={o.orderNumber}>
                      <p className="font-mono text-xs font-semibold text-foreground sm:text-sm">
                        {o.orderNumber}
                      </p>
                      <ol className="mt-1.5 list-decimal pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                        {o.lines.map((line) => (
                          <li key={`${o.orderNumber}-${line.lineIndex}`} className="pl-0.5">
                            <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
                              {!isVariantIdPlaceholderSku(line.sku) ? (
                                <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400 sm:text-sm">
                                  {formatKokobaySkuDisplay(line.sku)}
                                </span>
                              ) : null}
                              <span className="tabular-nums font-medium text-foreground">
                                ×{line.quantity}
                              </span>
                              <span className="text-zinc-600 dark:text-zinc-400">
                                {line.name}
                              </span>
                              {line.color ? (
                                <span className="text-zinc-500">· {line.color}</span>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </li>
                  ))}
                </ul>
              </div>
              <PicklistMarkCompleteButton
                dayKey={dayKey}
                pickListNumber={batch.displayPickListNumber}
                ordersPerList={appliedOrdersPerList}
                orderNumbers={batch.orderNumbers}
                steps={batch.steps}
                assembly={batch.assembly}
              />
            </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
