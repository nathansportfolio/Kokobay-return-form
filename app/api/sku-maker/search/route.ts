import {
  loadAllProductsForSkuMaker,
  searchSkuMakerProducts,
  type SkuMakerSearchHit,
} from "@/lib/skuMaker";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

/**
 * `GET /api/sku-maker/search?q=...&limit=30`
 *
 * Searches products across **all** statuses (active, draft, archived). The
 * SKU Maker page deliberately includes drafts so a not-yet-live product can
 * be SKU’d before publishing. Auth: site PIN (middleware) — no extra key.
 */
export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const q = (sp.get("q") ?? "").trim();
    const limitRaw = Number.parseInt(sp.get("limit") ?? "", 10);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(MAX_LIMIT, limitRaw)
        : DEFAULT_LIMIT;

    const r = await loadAllProductsForSkuMaker();
    if (!r.ok) {
      return Response.json(
        { error: r.error, results: [] as SkuMakerSearchHit[] },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const results = searchSkuMakerProducts(r.products, q, limit);
    return Response.json(
      {
        query: q,
        total: r.products.length,
        results,
      },
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
