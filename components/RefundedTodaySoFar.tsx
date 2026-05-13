import { formatGbp } from "@/lib/kokobayOrderLines";
import { aggregateReturnLogRefundTotalsLoggedTodayLondon } from "@/lib/returnLog";

/**
 * Server-only: expected refund totals from **`returnLogs`** whose **`createdAt`** is
 * today (London) — sum of **`totalRefundGbp`** (line-derived). Not the same as
 * Shopify money movement or `fullRefundIssuedAt`.
 */
export async function RefundedTodaySoFar({ className }: { className?: string }) {
  let total = 0;
  let count = 0;
  let distinctOrders = 0;
  try {
    console.log(
      "[RefundedTodaySoFar] loading: lib/returnLog.aggregateReturnLogRefundTotalsLoggedTodayLondon() (returnLogs, London today on createdAt)",
    );
    const s = await aggregateReturnLogRefundTotalsLoggedTodayLondon();
    total = s.totalRefundGbp;
    count = s.count;
    distinctOrders = s.distinctOrders;
    console.log("[RefundedTodaySoFar] display", {
      formattedTotal: formatGbp(total),
      returnLogsToday: count,
      distinctOrders,
    });
  } catch {
    return null;
  }
  return (
    <p className={className}>
      <span className="font-semibold text-foreground tabular-nums">
        {formatGbp(total)}
      </span>{" "}
      expected refunds from returns logged today
      <span className="text-zinc-500 dark:text-zinc-400">
        {" "}
        (London · {count} return{count === 1 ? "" : "s"} · {distinctOrders} order
        {distinctOrders === 1 ? "" : "s"} · line totals)
      </span>
    </p>
  );
}
