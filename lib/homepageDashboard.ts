import { getCompletedOrderNumbersSetForPicklistContext } from "@/lib/completedPicklist";
import { countOrderPickPausesForDay } from "@/lib/orderPickPause";
import { fetchTodaysOrderSummaries } from "@/lib/fetchTodaysOrderSummaries";
import { PICKLIST_LIST_KIND_UK_PREMIUM } from "@/lib/picklistListKind";
import {
  aggregateReturnLogRefundTotalsLoggedTodayLondon,
  countReturnLogsPendingFullRefund,
} from "@/lib/returnLog";
import { withPickableLinesOnly } from "@/lib/warehousePickableLine";
import { getTodayCalendarDateKeyInLondon } from "@/lib/warehouseLondonDay";
import { getUkPremiumShopifyOrdersForPicks, isShopifyWarehouseDataEnabled } from "@/lib/shopifyWarehouseDayOrders";

export type HomepageDashboardStats = {
  /** Orders in a completed pick for the pick-list day, vs total in that set. */
  pickListDayOrdersPicked: number;
  pickListDayOrderTotal: number;
  /** Standard pipeline: orders paused (missing stock), excluded from active picks. */
  pickListDayOrdersPausedMissingStock: number;
  /**
   * UK Premium NDD (Shopify) orders for today, London, not yet in a completed
   * `uk_premium` pick. Requires Shopify; otherwise `ukPremiumSpecialStatsOk` is false.
   */
  ukPremiumSpecialOrdersYetToPick: number;
  /** UK Premium pipeline: orders on missing-stock hold for today’s London day. */
  ukPremiumOrdersPausedMissingStock: number;
  returnsPendingRefund: number;
  /** `returnLogs` created today (London): count, sum of `totalRefundGbp`, distinct `orderRef`. */
  refundAuditTodayCount: number;
  refundAuditTodayTotalGbp: number;
  refundAuditTodayDistinctOrders: number;
  refundAuditTodayOk: boolean;
  orderStatsOk: boolean;
  returnsCountOk: boolean;
  ukPremiumSpecialStatsOk: boolean;
  /** YYYY-MM-DD of orders the pick list uses (yesterday, London) when `orderStatsOk`. */
  pickListOrderDayKey: string | null;
  /**
   * London calendar day for the UK Premium count (same “today” as
   * `/picklists/uk-premium`) when `ukPremiumSpecialStatsOk`.
   */
  ukPremiumOrderDayKey: string | null;
};

/**
 * Live counts for the home dashboard. Partial failure (e.g. one Mongo read)
 * is surfaced via the `*Ok` flags so the UI can show a dash.
 */
export async function getHomepageDashboardStats(): Promise<HomepageDashboardStats> {
  let pickListDayOrdersPicked = 0;
  let pickListDayOrderTotal = 0;
  let pickListDayOrdersPausedMissingStock = 0;
  let orderStatsOk = false;
  let returnsPendingRefund = 0;
  let returnsCountOk = false;
  let refundAuditTodayCount = 0;
  let refundAuditTodayTotalGbp = 0;
  let refundAuditTodayDistinctOrders = 0;
  let refundAuditTodayOk = false;
  let pickListOrderDayKey: string | null = null;
  let ukPremiumSpecialOrdersYetToPick = 0;
  let ukPremiumOrdersPausedMissingStock = 0;
  let ukPremiumSpecialStatsOk = false;
  let ukPremiumOrderDayKey: string | null = null;

  try {
    const { orders, dayKey } = await fetchTodaysOrderSummaries("pickList");
    orderStatsOk = true;
    pickListOrderDayKey = dayKey;
    pickListDayOrderTotal = orders.length;
    pickListDayOrdersPicked = orders.filter((o) => o.picked).length;
    pickListDayOrdersPausedMissingStock = orders.filter(
      (o) => o.pausedMissingStock,
    ).length;
  } catch {
    orderStatsOk = false;
  }

  try {
    if (isShopifyWarehouseDataEnabled()) {
      const dayKey = getTodayCalendarDateKeyInLondon();
      let premium = await getUkPremiumShopifyOrdersForPicks();
      premium = withPickableLinesOnly(premium);
      const completed = await getCompletedOrderNumbersSetForPicklistContext(
        dayKey,
        PICKLIST_LIST_KIND_UK_PREMIUM,
      );
      ukPremiumSpecialOrdersYetToPick = premium.filter(
        (o) => !completed.has(o.orderNumber),
      ).length;
      ukPremiumOrdersPausedMissingStock = await countOrderPickPausesForDay(
        dayKey,
        PICKLIST_LIST_KIND_UK_PREMIUM,
      );
      ukPremiumOrderDayKey = dayKey;
      ukPremiumSpecialStatsOk = true;
    }
  } catch {
    ukPremiumSpecialStatsOk = false;
  }

  try {
    returnsPendingRefund = await countReturnLogsPendingFullRefund();
    returnsCountOk = true;
  } catch {
    returnsCountOk = false;
  }

  try {
    const a = await aggregateReturnLogRefundTotalsLoggedTodayLondon();
    refundAuditTodayCount = a.count;
    refundAuditTodayTotalGbp = a.totalRefundGbp;
    refundAuditTodayDistinctOrders = a.distinctOrders;
    refundAuditTodayOk = true;
    console.log("[homepageDashboard] returns logged today (returnLogs)", {
      refundAuditTodayTotalGbp: a.totalRefundGbp,
      refundAuditTodayCount: a.count,
      refundAuditTodayDistinctOrders: a.distinctOrders,
    });
  } catch {
    refundAuditTodayOk = false;
  }

  return {
    pickListDayOrdersPicked,
    pickListDayOrderTotal,
    pickListDayOrdersPausedMissingStock,
    ukPremiumSpecialOrdersYetToPick,
    ukPremiumOrdersPausedMissingStock,
    returnsPendingRefund,
    refundAuditTodayCount,
    refundAuditTodayTotalGbp,
    refundAuditTodayDistinctOrders,
    refundAuditTodayOk,
    orderStatsOk,
    returnsCountOk,
    ukPremiumSpecialStatsOk,
    pickListOrderDayKey,
    ukPremiumOrderDayKey,
  };
}
