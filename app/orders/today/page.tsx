import type { Metadata } from "next";
import { fetchTodaysOrderSummaries } from "@/lib/fetchTodaysOrderSummaries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Today’s orders",
  description: "Orders for the warehouse day (Europe/London)",
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
          Could not load orders. Check MongoDB is configured and reachable.
        </p>
      </div>
    );
  }

  const { dayKey, timeZone, orders } = payload;
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
          Calendar day{" "}
          <span className="font-mono text-foreground">{dayKey}</span> (
          {timeZone}). Line counts, units to pick, and order total only — not
          the full pick list.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/50">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            No orders for this day
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Orders are matched by <code className="font-mono">createdAt</code>{" "}
            in the warehouse timezone. Seed or wait until the same calendar day
            as when orders were created.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60">
                <th className="px-4 py-3 font-semibold text-foreground">
                  Order
                </th>
                <th className="px-4 py-3 font-semibold text-foreground">Status</th>
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
