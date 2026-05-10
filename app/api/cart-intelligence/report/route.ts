import {
  getCartIntelligenceReport,
  parseReportRange,
} from "@/lib/cartIntelligence";

export const dynamic = "force-dynamic";

/**
 * `GET /api/cart-intelligence/report?from=ISO&to=ISO`
 *
 * Returns abandonment rates per stock bucket (low_stock / last_one / normal)
 * plus an overall figure. Auth: site PIN (middleware) — internal admin use.
 *
 * Default window is the trailing 30 days when no `from` is given.
 */
export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const range = parseReportRange(sp);
    const report = await getCartIntelligenceReport(range);
    return Response.json(
      { ok: true, report },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
