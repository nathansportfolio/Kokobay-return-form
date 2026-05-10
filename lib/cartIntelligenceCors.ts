/**
 * CORS for the public Cart Intelligence event endpoint. The Shopify Custom
 * Pixel runs in a sandboxed iframe whose origin is **not** the merchant
 * domain, and Web Pixel events forward `Origin` headers that vary per shop —
 * so we accept any origin but only echo back what we received (avoiding
 * `*` with credentials, which Shopify itself does not need).
 *
 * If you ever want to lock this down, set
 * `CART_INTELLIGENCE_ALLOWED_ORIGINS=https://kokobay.com,https://...` in
 * the server environment and only those origins will be echoed back.
 */
function readAllowedOrigins(): string[] | null {
  const raw = process.env.CART_INTELLIGENCE_ALLOWED_ORIGINS?.trim();
  if (!raw) return null;
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : null;
}

export function corsHeadersForRequest(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowList = readAllowedOrigins();

  // Vary on Origin so caches don’t mix responses across origins.
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

  // Permissive default (Shopify Web Pixels iframe origin is not stable).
  headers["Access-Control-Allow-Origin"] = origin || "*";
  return headers;
}

export function corsPreflightResponse(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeadersForRequest(req),
  });
}
