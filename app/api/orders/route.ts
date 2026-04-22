import { shopifyAdminGet } from "@/lib/shopifyAdminApi";
import type { ShopifyOrdersResponse } from "@/types/shopify";

const ORDERS_PATH = "orders.json?status=any&limit=250";

export async function GET() {
  try {
    if (!process.env.SHOPIFY_STORE?.trim()) {
      return Response.json(
        { error: "SHOPIFY_STORE is not configured" },
        { status: 500 },
      );
    }

    const { ok, status, data } =
      await shopifyAdminGet<ShopifyOrdersResponse>(ORDERS_PATH);
    if (!ok) {
      return Response.json(
        { error: "Shopify orders request failed", details: data },
        { status: status || 502 },
      );
    }

    return Response.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
