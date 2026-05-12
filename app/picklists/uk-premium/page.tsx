import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PicklistHowToFindProductsButton } from "@/components/PicklistHowToFindProductsButton";
import { PicklistMarkCompleteButton } from "@/components/PicklistMarkCompleteButton";
import { PicklistOrdersPerListSelect } from "@/components/PicklistOrdersPerListSelect";
import { WarehouseLocationLine } from "@/components/WarehouseLocationLine";
import { UK_PREMIUM_NDD_LINE_TITLE } from "@/lib/shopifyShippingLineTitles";
import { PICKLIST_LIST_KIND_UK_PREMIUM } from "@/lib/picklistListKind";
import {
  fetchUkPremiumPickLists,
  parseItemsPerListParam,
  parseOrdersPerListParam,
  pickStepForOrdersLabel,
} from "@/lib/fetchTodaysPickLists";
import { countOrderPickPausesForDay } from "@/lib/orderPickPause";
import { formatKokobaySkuDisplay } from "@/lib/skuDisplay";
import { isVariantIdPlaceholderSku } from "@/lib/variantIdPlaceholderSku";
import { AssemblyOrdersPanel } from "@/components/picklist/AssemblyOrdersPanel";
import { PicklistColorSwatch } from "@/components/picklist/PicklistColorSwatch";
import {
  PICK_LIST_TB_ACTION,
  PICK_LIST_TB_PRINT_UK,
  PICK_LIST_TB_SECONDARY,
  PICK_LIST_TOOLBAR_WRAP,
} from "@/components/picklist/pickListToolbarClasses";
import { formatDisplayColour } from "@/lib/formatDisplayColour";
import { PicklistPicksConsoleLogger } from "@/components/PicklistPicksConsoleLogger";
import { PicklistRefreshAndAllTypes } from "@/components/picklist/PicklistRefreshAndAllTypes";
import { PicklistStepOverviewThumb } from "@/components/picklist/PicklistStepOverviewThumb";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Next Day",
  description:
    "Batched pick walks: UK Premium Delivery, same day before 2pm, London",
};

const LIST = "/picklists/uk-premium";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UkPremiumPicklistsPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const ordersPerList = parseOrdersPerListParam(sp.ordersPerList);
  const itemsPerList = parseItemsPerListParam(sp.itemsPerList);

  let payload: Awaited<ReturnType<typeof fetchUkPremiumPickLists>>;
  try {
    payload = await fetchUkPremiumPickLists(ordersPerList, itemsPerList);
  } catch {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Next Day
        </h1>
        <p className="text-sm text-red-600 dark:text-red-400">
          Could not load pick lists. This flow requires{" "}
          <code className="font-mono">SHOPIFY_STORE</code> to be set.
        </p>
      </div>
    );
  }

  const {
    dayKey,
    batches,
    ordersPerList: appliedOrdersPerList,
    itemsPerList: appliedItemsPerList,
    totalPicklistsForDay,
    completedPicklistCount,
    dataSource,
  } = payload;
  const completedQuery = new URLSearchParams();
  completedQuery.set("ordersPerList", String(appliedOrdersPerList));
  completedQuery.set("itemsPerList", String(appliedItemsPerList));
  const printQuery = new URLSearchParams();
  printQuery.set("ordersPerList", String(appliedOrdersPerList));
  printQuery.set("itemsPerList", String(appliedItemsPerList));
  const showProgress = totalPicklistsForDay > 0 || completedPicklistCount > 0;

  let missingStockPauseCount = 0;
  try {
    missingStockPauseCount = await countOrderPickPausesForDay(
      dayKey,
      PICKLIST_LIST_KIND_UK_PREMIUM,
    );
  } catch {
    missingStockPauseCount = 0;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-4 pb-12 sm:p-6">
      <PicklistPicksConsoleLogger dayKey={dayKey} batches={batches} />
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col gap-2.5">
          <h1 className="min-w-0 text-2xl font-semibold leading-tight tracking-tight text-foreground">
            Next Day
          </h1>
          <div className={PICK_LIST_TOOLBAR_WRAP}>
            <PicklistHowToFindProductsButton />
            <PicklistRefreshAndAllTypes />
            <Link
              href={`${LIST}/completed?${completedQuery.toString()}`}
              className={`${PICK_LIST_TB_ACTION} ${PICK_LIST_TB_SECONDARY}`}
            >
              View completed
            </Link>
            <Link
              href={`${LIST}/print?${printQuery.toString()}`}
              className={`${PICK_LIST_TB_ACTION} ${PICK_LIST_TB_PRINT_UK}`}
            >
              Print all order labels
            </Link>
            <Link
              href={`${LIST}/missing-stock`}
              className={`${PICK_LIST_TB_ACTION} ${PICK_LIST_TB_SECONDARY}`}
            >
              Missing stock
              {missingStockPauseCount > 0
                ? ` (${missingStockPauseCount})`
                : ""}
            </Link>
          </div>
        </div>
        {missingStockPauseCount > 0 ? (
          <div
            className="rounded-xl border border-amber-300/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-700/80 dark:bg-amber-950/40 dark:text-amber-100/95"
            role="status"
          >
            <span className="font-semibold text-foreground">
              {missingStockPauseCount} order
              {missingStockPauseCount === 1 ? "" : "s"} on hold
            </span>{" "}
            (missing stock at a bin).{" "}
            <Link
              href={`${LIST}/missing-stock`}
              className="font-medium text-foreground underline underline-offset-2"
            >
              View missing stock
            </Link>
            .
          </div>
        ) : null}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-foreground">Shipping line:</span>{" "}
          {UK_PREMIUM_NDD_LINE_TITLE}. <span className="font-medium text-foreground">Cut-off:</span> same
          London day, before 2:00 PM, when the order was placed.
        </p>
        {dataSource === "shopify" ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Picks for this set are the same work day. Bins and walk use the same rules
            as the main list; only the order set is different. For standard picks, see{" "}
            <Link className="font-medium text-foreground underline" href="/picklists/today">
              Today’s pick lists
            </Link>
            .
          </p>
        ) : (
          <p className="text-sm text-amber-800 dark:text-amber-200/90">
            Connect Shopify in env to use this list.
          </p>
        )}
        {showProgress && dataSource === "shopify" && (
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
            <PicklistOrdersPerListSelect
              ordersValue={appliedOrdersPerList}
              itemsValue={appliedItemsPerList}
              listPath={LIST}
            />
          </Suspense>
        </div>
      </div>

      {dataSource !== "shopify" ? null : batches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50/50 p-8 text-center dark:border-amber-800/60 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            No UK Premium (before 2pm) orders left to pick
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            No orders match the shipping line and time window, or all are
            already completed. Check{" "}
            <Link
              className="font-medium text-foreground underline"
              href={LIST}
            >
              later in the day
            </Link>
            , or the{" "}
            <Link
              className="font-medium text-foreground underline"
              href="/picklists/today"
            >
              standard
            </Link>{" "}
            list.
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
                className="rounded-2xl border border-amber-200/90 bg-white shadow-sm dark:border-amber-800/50 dark:bg-zinc-950"
              >
                <div className="border-b border-amber-100 px-4 py-4 dark:border-amber-900/40 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold text-foreground">
                      Pick list {batch.displayPickListNumber}
                    </h2>
                    <Link
                      href={`${LIST}/walk?list=${batch.batchIndex}&ordersPerList=${appliedOrdersPerList}&itemsPerList=${appliedItemsPerList}`}
                      className="shrink-0 rounded-lg border-2 border-amber-600/90 bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:border-amber-700 hover:bg-amber-700 dark:border-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500"
                    >
                      Start picklist
                    </Link>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      Orders ({orderCount}):
                    </span>{" "}
                    <span className="font-mono text-zinc-800 dark:text-zinc-200">
                      {batch.orderNumbers.join(", ")}
                    </span>
                  </p>
                </div>

                <ol className="divide-y divide-amber-100/80 dark:divide-zinc-800/80">
                  {batch.steps.map((s) => (
                    <li
                      key={`${batch.batchIndex}-${s.step}`}
                      className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-900 text-sm font-semibold text-white dark:bg-amber-500 dark:text-amber-950"
                        aria-hidden
                      >
                        {s.step}
                      </span>
                      <PicklistStepOverviewThumb step={s} name={s.name} />
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
                            <p className="mt-1 flex min-h-[1.25rem] items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                              <PicklistColorSwatch hex={s.colorHex} />
                              {s.color ? (
                                <>
                                  <span className="text-zinc-500">Colour: </span>
                                  {formatDisplayColour(s.color)}
                                </>
                              ) : (
                                <span className="text-zinc-500">Colour: —</span>
                              )}
                            </p>
                            {s.size ? (
                              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                                <span className="text-zinc-500">Size: </span>
                                {s.size}
                              </p>
                            ) : null}
                            <p className="mt-1.5 text-xs text-zinc-500">
                              <span className="text-zinc-500">For: </span>
                              <span className="font-mono text-zinc-600 dark:text-zinc-400">
                                {pickStepForOrdersLabel(s)}
                              </span>
                            </p>
                            {(s.sourceLineItemCount ?? 1) > 1 ? (
                              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                                {s.forOrders.length > 1
                                  ? `This stop serves ${s.forOrders.length} orders. Pick ${s.quantity} in total. The title is from the first line only — use order assembly to split by product.`
                                  : `Pick ${s.quantity} in total: ${s.sourceLineItemCount ?? 1} product lines in this list share this location and SKU (e.g. top and bottoms) — the title is from the first; assembly lists each row.`}
                              </p>
                            ) : null}
                          </div>
                          <div
                            className="flex shrink-0 flex-col items-center gap-0.5 rounded-md border-2 border-zinc-900 bg-zinc-900 px-2 py-1.5 text-center dark:border-amber-500/90 dark:bg-amber-500"
                            title={`Pick ${s.quantity} unit${s.quantity === 1 ? "" : "s"}`}
                          >
                            <span className="text-[0.5rem] font-extrabold uppercase text-white/85">
                              Qty
                            </span>
                            <span className="text-xl font-extrabold tabular-nums text-white sm:text-2xl">
                              {s.quantity}
                            </span>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-100/90 bg-amber-50/40 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20 sm:px-5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-600">
                      Orders on this list
                    </span>
                    <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-sm font-extrabold tabular-nums dark:border-zinc-600 dark:bg-zinc-800 sm:text-base">
                      {orderCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-sm font-medium text-zinc-600">Total items</span>
                    <span className="inline-flex min-w-[3.25rem] items-center justify-center rounded-md border-2 border-amber-900/90 bg-amber-900 px-2.5 py-1 text-lg font-extrabold tabular-nums text-white dark:border-amber-500 dark:bg-amber-500 sm:text-xl">
                      {totalItemsQty}
                    </span>
                  </div>
                </div>

                <div className="border-t border-dashed border-amber-200/80 px-4 py-4 dark:border-zinc-700 sm:px-5">
                  <h3 className="text-sm font-semibold">Order assembly</h3>
                  <AssemblyOrdersPanel
                    orders={batch.assembly}
                    showDoneToggle
                    listClassName="mt-3 flex flex-col gap-4"
                    orderCardClassName="rounded-lg border border-dotted border-amber-200/90 bg-amber-50/40 p-3 sm:p-4 dark:border-zinc-600 dark:bg-zinc-900/40"
                  />
                </div>
                <PicklistMarkCompleteButton
                  dayKey={dayKey}
                  pickListNumber={batch.displayPickListNumber}
                  ordersPerList={appliedOrdersPerList}
                  itemsPerList={appliedItemsPerList}
                  orderNumbers={batch.orderNumbers}
                  steps={batch.steps}
                  assembly={batch.assembly}
                  listKind={PICKLIST_LIST_KIND_UK_PREMIUM}
                />
              </section>
            );
          })}
        </div>
      )}

      <p className="text-sm text-zinc-500">
        <Link href="/picklists" className="font-medium text-foreground underline">
          ← All pick list types
        </Link>
      </p>
    </div>
  );
}
