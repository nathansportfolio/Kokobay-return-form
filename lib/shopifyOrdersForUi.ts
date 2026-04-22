import { mapShopifyOrder } from "@/lib/mapShopifyOrder";
import { shopifyAdminGet } from "@/lib/shopifyAdminApi";
import type { Order, ShopifyOrdersResponse } from "@/types/shopify";

const ORDERS_PATH = "orders.json?status=any&limit=250";

type Result =
  | { ok: true; orders: Order[] }
  | { ok: false; error: string; orders: Order[] };

/**
 * Live Shopify orders (up to 250, any status), mapped to app `Order` type.
 * `/api/orders` and this share the same cached `shopifyAdminGet` call.
 */
export async function getShopifyOrdersForUi(): Promise<Result> {
  const empty: Order[] = [];
  try {
    const { ok, data } = await shopifyAdminGet<ShopifyOrdersResponse>(
      ORDERS_PATH,
    );
    if (!ok) {
      return {
        ok: false,
        error: "Could not load orders from Shopify",
        orders: empty,
      };
    }
    const raw = data?.orders ?? [];
    const orders = raw.map(mapShopifyOrder);
    orders.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return { ok: true, orders };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: message, orders: empty };
  }
}
