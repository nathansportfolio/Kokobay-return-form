/**
 * CORS for the public track-order API when the Shopify page embed calls
 * kokobay-returns.co.uk from kokobay.co.uk.
 *
 * Optional lock-down: `TRACK_ORDER_ALLOWED_ORIGINS=https://www.kokobay.co.uk,...`
 */
function readAllowedOrigins(): string[] | null {
  const raw = process.env.TRACK_ORDER_ALLOWED_ORIGINS?.trim();
  if (!raw) return null;
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : null;
}

export function trackOrderCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowList = readAllowedOrigins();

  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };

  if (allowList) {
    if (origin && allowList.includes(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
    }
    return headers;
  }

  headers["Access-Control-Allow-Origin"] = origin || "*";
  return headers;
}

export function trackOrderCorsPreflight(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: trackOrderCorsHeaders(req),
  });
}
