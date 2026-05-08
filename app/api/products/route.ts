import { fetchAllShopifyProducts } from "@/lib/fetchAllShopifyProducts";
import { runProductCatalogSyncInBackgroundIfStale } from "@/lib/productCatalogBackgroundSync";
import { shopifyAdminGet } from "@/lib/shopifyAdminApi";
import type { ShopifyProduct, ShopifyProductsResponse } from "@/types/shopify";

function isActiveShopifyProduct(p: ShopifyProduct): boolean {
  return String(p.status ?? "").toLowerCase() === "active";
}

/**
 * `GET /api/products` — first 250 **active** products only (cached) for light use.
 * `GET /api/products?all=1` — all **active** products only (paginated), for warehouse
 * add-to-bin search so any product is findable by title/SKU, not just the
 * first page of 250.
 *
 * No API-key gate — rely on site PIN (middleware) + server-only Shopify credentials.
 */
export async function GET(request: Request) {
  try {
    runProductCatalogSyncInBackgroundIfStale();
    const all = new URL(request.url).searchParams.get("all");
    if (all === "1" || all?.toLowerCase() === "true" || all === "yes") {
      const r = await fetchAllShopifyProducts({ status: "active" });
      if (!r.ok) {
        return Response.json(
          { error: r.error, products: [] as ShopifyProduct[] },
          { status: 502, headers: { "Cache-Control": "no-store" } },
        );
      }
      const products = r.products.filter(isActiveShopifyProduct);
      return Response.json(
        { products },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const { ok, status, data } =
      await shopifyAdminGet<ShopifyProductsResponse>(
        "products.json?limit=250&status=active",
      );
    if (!ok) {
      return Response.json(
        { error: "Shopify products request failed", details: data },
        { status: status || 502 },
      );
    }
    const products = (data?.products ?? []).filter(isActiveShopifyProduct);
    return Response.json(
      { ...data, products },
      {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
