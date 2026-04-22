import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PicklistMarkCompleteButton } from "@/components/PicklistMarkCompleteButton";
import { PicklistOrdersPerListSelect } from "@/components/PicklistOrdersPerListSelect";
import { WarehouseLocationLine } from "@/components/WarehouseLocationLine";
import {
  fetchTodaysPickLists,
  parseOrdersPerListParam,
} from "@/lib/fetchTodaysPickLists";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Today’s pick lists",
  description: "Batched pick walks for today’s warehouse orders",
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
          Could not load pick lists. Check MongoDB is configured and reachable.
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
  } = payload;
  const completedQuery = new URLSearchParams();
  completedQuery.set("ordersPerList", String(appliedOrdersPerList));
  const showProgress =
    totalPicklistsForDay > 0 || completedPicklistCount > 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-4 pb-12 sm:p-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-2xl font-semibold leading-tight tracking-tight text-foreground">
            Today’s pick lists
          </h1>
          <Link
            href={`/picklists/today/completed?${completedQuery.toString()}`}
            className="shrink-0 pt-0.5 text-sm font-medium text-foreground underline decoration-zinc-400 underline-offset-2 hover:decoration-foreground"
          >
            View completed
          </Link>
        </div>
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
            Pick lists follow the same calendar day as{" "}
            <span className="font-medium text-foreground">Today’s orders</span>.
            Seed orders on the current day, or open that page to confirm dates.
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
                    className="shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/80 dark:hover:bg-zinc-800"
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
                          <p className="mt-1.5 min-w-0 break-all font-mono text-xs text-zinc-500 sm:text-sm">
                            <span className="text-zinc-500 dark:text-zinc-400">
                              SKU:{" "}
                            </span>
                            <span className="font-medium text-foreground">
                              {s.sku}
                            </span>
                          </p>
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
                            <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400 sm:text-sm">
                              {line.sku}
                            </span>
                            <span className="ml-1.5 tabular-nums font-medium text-foreground">
                              ×{line.quantity}
                            </span>
                            <span className="ml-1.5 text-zinc-600 dark:text-zinc-400">
                              {line.name}
                            </span>
                            {line.color ? (
                              <span className="ml-1.5 text-zinc-500">
                                · {line.color}
                              </span>
                            ) : null}
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
