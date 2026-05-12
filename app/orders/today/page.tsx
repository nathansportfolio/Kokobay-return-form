import type { Metadata } from "next";
import { fetchTodaysOrderSummaries } from "@/lib/fetchTodaysOrderSummaries";
import { formatDayKeyAsOrdinalEnglish } from "@/lib/warehouseLondonDay";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Today’s orders",
  description: "Orders for the current warehouse day",
};

export default async function TodaysOrdersPage() {
  let payload: Awaited<ReturnType<typeof fetchTodaysOrderSummaries>>;
  try {
    payload = await fetchTodaysOrderSummaries();
  } catch {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Today’s orders
        </h1>
        <p className="text-sm text-red-600 dark:text-red-400">
          Could not load orders. If you use Shopify, set{" "}
          <code className="font-mono">SHOPIFY_STORE</code> and API credentials. Otherwise
          check MongoDB is configured for sample orders.
        </p>
      </div>
    );
  }

  const { dayKey, orders, dataSource } = payload;
  const sorted = [...orders].sort((a, b) =>
    a.orderNumber.localeCompare(b.orderNumber),
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Today’s orders
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-foreground">
            {formatDayKeyAsOrdinalEnglish(dayKey)}
          </span>
          {dataSource === "shopify" ? (
            <>
              . <span className="font-medium text-foreground">Live from Shopify</span>{" "}
              (orders with <code> createdAt</code> in that London day, loaded with
              pagination). Picked state matches the pick lists.
            </>
          ) : (
            <>
              . From MongoDB sample <code>orders</code> — not Shopify. Set{" "}
              <code className="text-xs">SHOPIFY_STORE</code> for real orders.
            </>
          )}{" "}
          Not the full walk — use Today&apos;s pick lists to pick.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/50">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            No orders for this day
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {dataSource === "shopify" ? (
              <>
                No Shopify orders with <code> createdAt</code> on this warehouse
                day. If the clock or timezone is wrong, check the server and{" "}
                <code>WAREHOUSE_TZ</code> match your expectations.
              </>
            ) : (
              <>
                Sample orders are matched by <code className="font-mono">createdAt</code>{" "}
                to the warehouse day. Seed mock orders or enable Shopify.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60">
                <th className="px-4 py-3 font-semibold text-foreground">
                  Order
                </th>
                <th className="px-4 py-3 font-semibold text-foreground">Status</th>
                <th className="px-4 py-3 font-semibold text-foreground">Picked / hold</th>
                <th className="px-4 py-3 font-semibold text-foreground text-right">
                  Lines
                </th>
                <th className="px-4 py-3 font-semibold text-foreground text-right">
                  Units to pick
                </th>
                <th className="px-4 py-3 font-semibold text-foreground text-right">
                  Total
                </th>
                <th className="px-4 py-3 font-semibold text-foreground">
                  Pick preview
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((o) => (
                <tr
                  key={o.orderNumber}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                >
                  <td className="px-4 py-3 font-mono text-xs text-foreground sm:text-sm">
                    {o.orderNumber}
                  </td>
                  <td className="px-4 py-3 capitalize text-zinc-700 dark:text-zinc-300">
                    {o.status}
                  </td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200">
                    <div className="flex flex-wrap gap-1.5">
                      {o.picked ? (
                        <span
                          className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:border-emerald-800/80 dark:bg-emerald-950/50 dark:text-emerald-200"
                          title="This order was included in a completed pick for today’s warehouse day"
                        >
                          Picked
                        </span>
                      ) : null}
                      {o.pausedMissingStock ? (
                        <span
                          className="inline-flex rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-950 dark:border-amber-700/80 dark:bg-amber-950/45 dark:text-amber-100"
                          title="Paused: missing stock at a bin — excluded from active pick lists"
                        >
                          On hold
                        </span>
                      ) : null}
                      {!o.picked && !o.pausedMissingStock ? (
                        <span className="text-xs text-zinc-500">—</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-800 dark:text-zinc-200">
                    {o.lineCount}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-800 dark:text-zinc-200">
                    {o.unitsToPick}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                    {o.totalFormatted}
                  </td>
                  <td className="max-w-[14rem] px-4 py-3 text-xs leading-snug text-zinc-600 dark:text-zinc-400 sm:max-w-xs sm:text-sm">
                    {o.pickPreview}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
