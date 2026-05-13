import { formatGbp } from "@/lib/kokobayOrderLines";
import { countRefundsToday } from "@/lib/refundAuditLog";

/**
 * Server-only: “Refunded today” from internal **`refundAuditLogs`** only (staff
 * used **Refund in Shopify** in the app — opens Admin; audit row is intent/analytics).
 */
export async function RefundedTodaySoFar({ className }: { className?: string }) {
  let total = 0;
  let count = 0;
  try {
    const s = await countRefundsToday();
    total = s.totalAmount;
    count = s.count;
  } catch {
    return null;
  }
  return (
    <p className={className}>
      <span className="font-semibold text-foreground tabular-nums">
        {formatGbp(total)}
      </span>{" "}
      refunded today so far
      <span className="text-zinc-500 dark:text-zinc-400">
        {" "}
        (London · {count} staff refund{count === 1 ? "" : "s"} · audit log only)
      </span>
    </p>
  );
}
