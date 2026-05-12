import { formatGbp } from "@/lib/kokobayOrderLines";
import { sumRecordedRefundsGbpForLondonCalendarDay } from "@/lib/returnRefundLedger";
import { getTodayCalendarDateKeyInLondon } from "@/lib/warehouseLondonDay";

/** Server-only: sums `returnRefundLedger` for the current London calendar day. */
export async function RefundedTodaySoFar({ className }: { className?: string }) {
  let total: number;
  try {
    total = await sumRecordedRefundsGbpForLondonCalendarDay(
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
