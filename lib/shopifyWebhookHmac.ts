import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies `X-Shopify-Hmac-Sha256` for HTTPS webhooks (raw body, UTF-8).
 * Uses `SHOPIFY_CLIENT_SECRET` (same secret Shopify documents for custom apps).
 */
export function verifyShopifyWebhookHmac(
  rawBody: string,
  hmacHeader: string | null | undefined,
  clientSecret: string,
): boolean {
  const h = String(hmacHeader ?? "").trim();
  const secret = String(clientSecret ?? "").trim();
  if (!h || !secret) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(h, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
