import { formatGbp } from "@/lib/kokobayOrderLines";
import { sumRecordedRefundsGbpForLondonCalendarDay } from "@/lib/returnRefundLedger";
import { sumShopifyRefundAmountsGbpForLondonCalendarDay } from "@/lib/shopifyRefundEvents";
import { getTodayCalendarDateKeyInLondon } from "@/lib/warehouseLondonDay";

/**
 * Server-only: “Refunded today” = **Shopify** `refunds/create` webhooks (`shopifyRefundEvents`)
 * **plus** **in-app** “mark refund complete” rows (`returnRefundLedger`), both filtered by
 * London calendar day on the respective timestamps.
 */
export async function RefundedTodaySoFar({ className }: { className?: string }) {
  const dayKey = getTodayCalendarDateKeyInLondon();
  let shopify = 0;
  let inApp = 0;
  try {
    [shopify, inApp] = await Promise.all([
      sumShopifyRefundAmountsGbpForLondonCalendarDay(dayKey),
      sumRecordedRefundsGbpForLondonCalendarDay(dayKey),
    ]);
  } catch {
    return null;
  }
  const total = Math.round((shopify + inApp) * 100) / 100;
  return (
    <p className={className}>
      <span className="font-semibold text-foreground tabular-nums">
        {formatGbp(total)}
      </span>{" "}
      refunded today so far
      <span className="text-zinc-500 dark:text-zinc-400">
        {" "}
        (London · Shopify {formatGbp(shopify)} + in-app {formatGbp(inApp)})
      </span>
    </p>
  );
}
