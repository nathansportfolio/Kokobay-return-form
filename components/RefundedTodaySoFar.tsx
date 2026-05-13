import { formatGbp } from "@/lib/kokobayOrderLines";
import { sumFullRefundAmountsGbpForLondonCalendarDay } from "@/lib/returnLog";
import { getTodayCalendarDateKeyInLondon } from "@/lib/warehouseLondonDay";

/**
 * Server-only: sums `fullRefundAmountGbp` on `returnLogs` where
 * `fullRefundIssuedAt` falls on the current London calendar day (when staff
 * marked the refund complete — not return log date or order date).
 */
export async function RefundedTodaySoFar({ className }: { className?: string }) {
  let total: number;
  try {
    total = await sumFullRefundAmountsGbpForLondonCalendarDay(
      getTodayCalendarDateKeyInLondon(),
    );
  } catch {
    return null;
  }
  return (
    <p className={className}>
      <span className="font-semibold text-foreground tabular-nums">
        {formatGbp(total)}
      </span>{" "}
      refunded today so far
      <span className="text-zinc-500 dark:text-zinc-400"> (London)</span>
    </p>
  );
}
