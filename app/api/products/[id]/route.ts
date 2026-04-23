import { shopifyAdminGetNoCache } from "@/lib/shopifyAdminApi";
import { runProductCatalogSyncInBackgroundIfStale } from "@/lib/shopifyProductCatalog";
import type { ShopifySingleProductResponse } from "@/types/shopify";

export const dynamic = "force-dynamic";

const ID_RE = /^\d+$/;

/**
 * GET /api/products/56093970366850
 * Proxy to Shopify Admin: GET products/{id}.json (uncached, server-only token).
 * Example: `curl -sS http://localhost:3000/api/products/56093970366850` (with session / PIN if your app enforces it).
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
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
