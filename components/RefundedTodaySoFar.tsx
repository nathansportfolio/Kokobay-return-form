import { formatGbp } from "@/lib/kokobayOrderLines";
import { sumShopifyRefundAmountsGbpForLondonCalendarDay } from "@/lib/shopifyRefundEvents";
import { getTodayCalendarDateKeyInLondon } from "@/lib/warehouseLondonDay";

/**
 * Server-only: sums **Shopify Admin** refunds recorded via `refunds/create`
 * webhook (`shopifyRefundEvents`), using each refund’s Shopify `created_at`
 * on the current London calendar day (not Kokobay return-log dates).
 */
export async function RefundedTodaySoFar({ className }: { className?: string }) {
  let total: number;
  try {
    total = await sumShopifyRefundAmountsGbpForLondonCalendarDay(
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
      <span className="text-zinc-500 dark:text-zinc-400">
        {" "}
        (London · Shopify)
      </span>
    </p>
  );
}
