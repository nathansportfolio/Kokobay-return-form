import { shopifyAdminGet } from "@/lib/shopifyAdminApi";
import type { ShopifyProductsResponse } from "@/types/shopify";

export async function GET() {
  try {
    const { ok, status, data } =
      await shopifyAdminGet<ShopifyProductsResponse>("products.json?limit=250");
    if (!ok) {
      return Response.json(
        { error: "Shopify products request failed", details: data },
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
