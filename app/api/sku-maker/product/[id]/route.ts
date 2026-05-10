import {
  clearSkuMakerProductCache,
  loadAllProductsForSkuMaker,
  proposeSkusForProduct,
} from "@/lib/skuMaker";

export const dynamic = "force-dynamic";

const ID_RE = /^\d+$/;

/**
 * `GET /api/sku-maker/product/[id]`
 *
 * Returns the selected product (any status, including draft) plus a proposed
 * canonical SKU per variant — deduped against every other variant SKU in
 * the shop. `?refresh=1` re-fetches from Shopify (bypasses the 30s memo).
 *
 * Auth: site PIN (middleware) — no extra key.
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: raw } = await context.params;
    const id = String(raw ?? "").trim();
    if (!id || !ID_RE.test(id)) {
      return Response.json(
        { error: "Invalid product id (expect digits only)" },
        { status: 400 },
      );
    }

    const sp = new URL(req.url).searchParams;
    if (
      sp.get("refresh") === "1" ||
      sp.get("refresh")?.toLowerCase() === "true"
    ) {
      clearSkuMakerProductCache();
    }

    const r = await loadAllProductsForSkuMaker();
    if (!r.ok) {
      return Response.json(
        { error: r.error },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const productId = Number.parseInt(id, 10);
    const product = r.products.find((p) => p.id === productId);
    if (!product) {
      return Response.json(
        { error: "Product not found in any status (active / draft / archived)" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const result = proposeSkusForProduct(product, r.products);
    return Response.json(
      { ok: true, product: result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
