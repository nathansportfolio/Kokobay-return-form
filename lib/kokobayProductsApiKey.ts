import type { NextRequest } from "next/server";

/** Send this header (or `Authorization: Bearer <same value>`) on all `GET /api/products` calls. */
export const KOKOBAY_PRODUCTS_API_KEY_HEADER = "x-kokobay-products-api-key";

/**
 * Server reads `KOKOBAY_PRODUCTS_API_KEY` first, then `NEXT_PUBLIC_KOKOBAY_PRODUCTS_API_KEY`
 * (same value in `.env.local` so the warehouse UI can attach it from the browser bundle).
 */
export function expectedProductsApiKey(): string | undefined {
  return (
    process.env.KOKOBAY_PRODUCTS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_KOKOBAY_PRODUCTS_API_KEY?.trim()
  );
}

export function productsApiKeyFromRequest(
  request: Pick<Request, "headers">,
): string | undefined {
  const h = request.headers.get(KOKOBAY_PRODUCTS_API_KEY_HEADER)?.trim();
  if (h) {
    return h;
  }
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return undefined;
}

export function isValidProductsApiKeyRequest(
  request: Pick<Request, "headers">,
): boolean {
  const expected = expectedProductsApiKey();
  if (!expected) {
    return false;
  }
  const got = productsApiKeyFromRequest(request);
  return got === expected;
}

export function isValidProductsApiKeyNextRequest(req: NextRequest): boolean {
  return isValidProductsApiKeyRequest(req);
}
