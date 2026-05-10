import {
  enrichEventWithShopifyInventory,
  hashClientIp,
  insertCartIntelligenceEvent,
  validateCartIntelligenceEvent,
} from "@/lib/cartIntelligence";
import {
  corsHeadersForRequest,
  corsPreflightResponse,
} from "@/lib/cartIntelligenceCors";

export const dynamic = "force-dynamic";

const MAX_USER_AGENT = 512;
const MAX_BODY_BYTES = 8 * 1024;

function clientIpFromRequest(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for") ?? "";

  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    null
  );
}

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request) {
  const cors = corsHeadersForRequest(request);

  let raw: string;

  try {
    raw = await request.text();
  } catch {
    return Response.json(
      { ok: false, error: "Could not read request body" },
      { status: 400, headers: { ...cors, "Cache-Control": "no-store" } },
    );
  }

  if (raw.length > MAX_BODY_BYTES) {
    return Response.json(
      { ok: false, error: "Body too large" },
      { status: 413, headers: { ...cors, "Cache-Control": "no-store" } },
    );
  }

  let body: unknown;

  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400, headers: { ...cors, "Cache-Control": "no-store" } },
    );
  }

  const v = validateCartIntelligenceEvent(body);

  if (!v.ok) {
    return Response.json(
      { ok: false, error: v.error },
      { status: 400, headers: { ...cors, "Cache-Control": "no-store" } },
    );
  }

  const ua = (request.headers.get("user-agent") ?? "")
    .trim()
    .slice(0, MAX_USER_AGENT);

  const ip = clientIpFromRequest(request);

  // Server-side enrichment: replace whatever the pixel sent for inventory
  // with a fresh value from Shopify Admin REST. The helper has its own 3 s
  // timeout + in-memory TTL cache, so this is bounded — and on failure we
  // *still* save the event using whatever the pixel hinted at. Analytics
  // ingest must never break the storefront.
  const enriched = await enrichEventWithShopifyInventory(v.data);

  if (enriched.lookup && !enriched.lookup.ok) {
    console.warn("[cart-intelligence/event] inventory enrichment failed:", {
      variant_id: v.data.variant_id,
      reason: enriched.lookup.reason,
      message: enriched.lookup.message,
    });
  }

  try {
    await insertCartIntelligenceEvent(enriched.data, {
      user_agent: ua || null,
      ip_hash: hashClientIp(ip),
      inventory_source: enriched.inventory_source,
    });

    return Response.json(
      {
        ok: true,
        inventory_remaining: enriched.data.inventory_remaining,
        low_stock: enriched.data.low_stock,
        last_one: enriched.data.last_one,
        stock_bucket: enriched.data.last_one
          ? "last_one"
          : enriched.data.low_stock
            ? "low_stock"
            : "normal",
        inventory_source: enriched.inventory_source,
      },
      { status: 202, headers: { ...cors, "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[cart-intelligence/event] insert failed:", e);

    return Response.json(
      { ok: false, error: "Could not record event" },
      { status: 500, headers: { ...cors, "Cache-Control": "no-store" } },
    );
  }
}