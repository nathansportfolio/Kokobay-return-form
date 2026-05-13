import { insertShopifyRefundEventFromWebhook } from "@/lib/shopifyRefundEvents";
import { verifyShopifyWebhookHmac } from "@/lib/shopifyWebhookHmac";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Shopify Admin HTTPS webhook: `refunds/create`.
 *
 * Register in Shopify Partner / custom app: **Event** `Refunds create`,
 * URL `https://<your-host>/api/webhooks/shopify/refunds-create`.
 * Signing secret: same as `SHOPIFY_CLIENT_SECRET` (client credentials app).
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret =
    process.env.SHOPIFY_CLIENT_SECRET?.trim() ||
    process.env.SHOPIFY_API_SECRET?.trim();
  if (!secret) {
    console.error("[webhook refunds/create] SHOPIFY_CLIENT_SECRET is not set");
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const hmac =
    request.headers.get("X-Shopify-Hmac-Sha256") ??
    request.headers.get("x-shopify-hmac-sha256");

  if (!verifyShopifyWebhookHmac(rawBody, hmac, secret)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const topic = (
    request.headers.get("X-Shopify-Topic") ??
    request.headers.get("x-shopify-topic") ??
    ""
  ).trim();
  if (topic.toLowerCase() !== "refunds/create") {
    return new NextResponse("OK", { status: 200 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  try {
    const result = await insertShopifyRefundEventFromWebhook(body);
    if (!result.ok) {
      console.warn("[webhook refunds/create] skipped:", result.error);
    }
    return new NextResponse("OK", { status: 200 });
  } catch (e) {
    console.error("[webhook refunds/create]", e);
    return new NextResponse("Error", { status: 500 });
  }
}
