import {
  fetchOvernightWindowOrders,
  getOvernightReportWindowBoundsUtc,
  toOvernightReportEntries,
} from "@/lib/shopifyOvernightWindowOrders";
import { WAREHOUSE_TZ } from "@/lib/warehouseLondonDay";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/overnight
 *
 * Orders placed between **yesterday 17:00** and **today 08:30** (Europe/London).
 * Response: customer email, line items (title, qty, sku), and order time (UTC + London).
 *
 * Requires `SHOPIFY_STORE`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`.
 * Respects site PIN middleware when enforcement is enabled.
 */
export async function GET() {
  try {
    if (!process.env.SHOPIFY_STORE?.trim()) {
      return Response.json(
        { ok: false, error: "SHOPIFY_STORE is not configured" },
        { status: 500 },
      );
    }

    const windowMeta = getOvernightReportWindowBoundsUtc();
    const raw = await fetchOvernightWindowOrders();
    const orders = toOvernightReportEntries(raw);

    return Response.json(
      {
        ok: true,
        window: {
          timezone: WAREHOUSE_TZ,
          fromLondon: windowMeta.labelFromLondon,
          toLondon: windowMeta.labelToLondon,
          createdAtMinUtc: windowMeta.createdAtMin,
          createdAtMaxUtc: windowMeta.createdAtMax,
        },
        orderCount: orders.length,
        orders,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
