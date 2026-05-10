import {
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

/** First entry of `x-forwarded-for`, falling back to direct connection IP. */
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

/**
 * `OPTIONS /api/cart-intelligence/event` — CORS preflight (handles the
 * Shopify Web Pixel sandbox sending `Content-Type: application/json`).
 */
export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

/**
 * `POST /api/cart-intelligence/event`
 *
 * Public endpoint hit by the Shopify Custom Pixel. Whitelisted in
 * `middleware.ts` (no PIN cookie required) so storefront events can post
 * directly. We **never** store the raw IP — only a salted SHA-256.
 */
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
  const meta = {
    user_agent: ua || null,
    ip_hash: hashClientIp(ip),
  };

  try {
    await insertCartIntelligenceEvent(v.data, meta);
    return Response.json(
      { ok: true },
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
