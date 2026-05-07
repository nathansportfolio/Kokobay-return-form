import { fetchAllShopifyProducts } from "@/lib/fetchAllShopifyProducts";
import {
  expectedProductsApiKey,
  isValidProductsApiKeyRequest,
  KOKOBAY_PRODUCTS_API_KEY_HEADER,
} from "@/lib/kokobayProductsApiKey";
import { runProductCatalogSyncInBackgroundIfStale } from "@/lib/productCatalogBackgroundSync";
import { shopifyAdminGet } from "@/lib/shopifyAdminApi";
import type { ShopifyProduct, ShopifyProductsResponse } from "@/types/shopify";

/**
 * `GET /api/products` — first 250 (cached) for light use.
 * `GET /api/products?all=1` — all active products (paginated), for warehouse
 * add-to-bin search so any product is findable by title/SKU, not just the
 * first page of 250.
 */
export async function GET(request: Request) {
  try {
    if (!expectedProductsApiKey()) {
      return Response.json(
        {
          error:
            "Server misconfiguration: set KOKOBAY_PRODUCTS_API_KEY (and NEXT_PUBLIC_KOKOBAY_PRODUCTS_API_KEY for the browser) in the environment.",
        },
        { status: 503 },
      );
    }
    if (!isValidProductsApiKeyRequest(request)) {
      return Response.json(
        {
          error: "Unauthorized",
          hint: `Send header ${KOKOBAY_PRODUCTS_API_KEY_HEADER}: <key> or Authorization: Bearer <key>`,
        },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    runProductCatalogSyncInBackgroundIfStale();
    const all = new URL(request.url).searchParams.get("all");
    if (all === "1" || all?.toLowerCase() === "true" || all === "yes") {
      const r = await fetchAllShopifyProducts();
      if (!r.ok) {
        return Response.json(
          { error: r.error, products: [] as ShopifyProduct[] },
          { status: 502, headers: { "Cache-Control": "no-store" } },
        );
      }
      return Response.json(
        { products: r.products },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

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
