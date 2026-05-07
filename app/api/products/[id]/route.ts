import {
  expectedProductsApiKey,
  isValidProductsApiKeyRequest,
  KOKOBAY_PRODUCTS_API_KEY_HEADER,
} from "@/lib/kokobayProductsApiKey";
import { shopifyAdminGetNoCache } from "@/lib/shopifyAdminApi";
import { runProductCatalogSyncInBackgroundIfStale } from "@/lib/productCatalogBackgroundSync";
import type { ShopifySingleProductResponse } from "@/types/shopify";

export const dynamic = "force-dynamic";

const ID_RE = /^\d+$/;

/**
 * GET /api/products/56093970366850
 * Proxy to Shopify Admin: GET products/{id}.json (uncached, server-only token).
 * Example: `curl -sS -H "x-kokobay-products-api-key: $KOKOBAY_PRODUCTS_API_KEY" http://localhost:3000/api/products/56093970366850`
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
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
    if (!isValidProductsApiKeyRequest(req)) {
      return Response.json(
        {
          error: "Unauthorized",
          hint: `Send header ${KOKOBAY_PRODUCTS_API_KEY_HEADER}: <key> or Authorization: Bearer <key>`,
        },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    runProductCatalogSyncInBackgroundIfStale();
    if (!process.env.SHOPIFY_STORE?.trim()) {
      return Response.json(
        { error: "SHOPIFY_STORE is not set" },
        { status: 500 },
      );
    }
    const { id: raw } = await context.params;
    const id = String(raw ?? "").trim();
    if (!id || !ID_RE.test(id)) {
      return Response.json(
        { error: "Invalid product id (expect digits only)" },
        { status: 400 },
      );
    }

    const { ok, status, data } =
      await shopifyAdminGetNoCache<ShopifySingleProductResponse>(
        `products/${id}.json`,
      );

    if (!ok) {
      return Response.json(
        { error: "Shopify product request failed", details: data },
        { status: status === 404 ? 404 : status || 502 },
      );
    }
    return Response.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
