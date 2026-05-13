import { formatGbp } from "@/lib/kokobayOrderLines";
import { aggregateReturnLogRefundTotalsLoggedTodayLondon } from "@/lib/returnLog";

/**
 * Server-only: sum of **`totalRefundGbp`** on **`returnLogs`** where staff set
 * **`refunded`** true today (London calendar day on **`refundedAt`**).
 */
export async function RefundedTodaySoFar({ className }: { className?: string }) {
  let total = 0;
  let count = 0;
  let distinctOrders = 0;
  try {
    console.log(
      "[RefundedTodaySoFar] loading: aggregateReturnLogRefundTotalsLoggedTodayLondon (refunded=true, refundedAt in London today)",
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
      marked refunded today (line totals)
      <span className="text-zinc-500 dark:text-zinc-400">
        {" "}
        (London · {count} return{count === 1 ? "" : "s"} · {distinctOrders} order
        {distinctOrders === 1 ? "" : "s"} · Refund in Shopify on Logged)
      </span>
    </p>
  );
}
