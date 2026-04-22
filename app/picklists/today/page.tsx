import type { Metadata } from "next";
import { WarehouseLocationLine } from "@/components/WarehouseLocationLine";
import { fetchTodaysPickLists } from "@/lib/fetchTodaysPickLists";
import { binBadgeStyleFromLetterIndex } from "@/lib/warehouseLocationCodes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Today’s pick lists",
  description: "Batched pick walks for today’s orders (5 orders per list)",
};

export default async function TodaysPickListsPage() {
  let payload: Awaited<ReturnType<typeof fetchTodaysPickLists>>;
  try {
    payload = await fetchTodaysPickLists();
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

  const { dayKey, timeZone, batches } = payload;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-4 pb-12 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Today’s pick lists
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Day <span className="font-mono text-foreground">{dayKey}</span> (
          {timeZone}). Up to{" "}
          <span className="font-medium text-foreground">5</span> orders per list.
          Stops are ordered by row, then bin, then SKU — grab everything at each bin
          before moving on. Quantities are merged when the same SKU appears in more
          than one of the five orders.
        </p>
        <div className="mt-3 flex flex-col gap-2 text-xs text-zinc-500">
          <span className="font-medium text-zinc-600 dark:text-zinc-400">
            Bin colour = first aisle letter after &quot;Bin&quot; — vivid gradient
            (e.g. A green, B light green, C blue, … Z red); each letter has its own
            hue.
          </span>
          <div className="flex flex-wrap gap-1" aria-label="Letter colour key A to Z">
            {Array.from({ length: 26 }, (_, i) => (
              <span
                key={i}
                className="inline-flex h-6 min-w-6 items-center justify-center rounded px-1 font-mono text-[11px] font-semibold"
                style={binBadgeStyleFromLetterIndex(i)}
              >
                {String.fromCharCode(65 + i)}
              </span>
            ))}
          </div>
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
          {batches.map((batch) => (
            <section
              key={batch.batchIndex}
              className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800 sm:px-5">
                <h2 className="text-lg font-semibold text-foreground">
                  Pick list {batch.batchIndex}
                </h2>
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
                      <WarehouseLocationLine row={s.row} bin={s.bin} />
                      <p className="mt-0.5 font-mono text-xs text-zinc-600 dark:text-zinc-400 sm:text-sm">
                        {s.sku}{" "}
                        <span className="text-foreground">×{s.quantity}</span>
                      </p>
                      <p className="mt-1 text-sm leading-snug text-zinc-700 dark:text-zinc-300">
                        {s.name}
                      </p>
                      <p className="mt-2 text-xs text-zinc-500">
                        For:{" "}
                        <span className="font-mono text-zinc-600 dark:text-zinc-400">
                          {s.forOrders.join(", ")}
                        </span>
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
