import {
  extractRefundFromWebhookBody,
  insertShopifyRefundEventFromWebhook,
} from "@/lib/shopifyRefundEvents";
import { verifyShopifyWebhookHmac } from "@/lib/shopifyWebhookHmac";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Shopify Admin HTTPS webhook: `refunds/create`.
 *
 * Register in Shopify: **Event** `Refunds create`,
 * URL `https://<your-host>/api/webhooks/shopify/refunds-create`.
 *
 * HMAC signing: use **`SHOPIFY_WEBHOOK_SECRET`** if set (recommended: app “API secret key”
 * copied when configuring webhooks), else **`SHOPIFY_CLIENT_SECRET`**, else **`SHOPIFY_API_SECRET`**.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret =
    process.env.SHOPIFY_WEBHOOK_SECRET?.trim() ||
    process.env.SHOPIFY_CLIENT_SECRET?.trim() ||
    process.env.SHOPIFY_API_SECRET?.trim();
  if (!secret) {
    console.error(
      "[webhook refunds/create] no webhook signing secret (set SHOPIFY_WEBHOOK_SECRET or SHOPIFY_CLIENT_SECRET)",
    );
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const hmac =
    request.headers.get("X-Shopify-Hmac-Sha256") ??
    request.headers.get("x-shopify-hmac-sha256");

  if (!verifyShopifyWebhookHmac(rawBody, hmac, secret)) {
    console.warn("[webhook refunds/create] HMAC verification failed", {
      hasHmacHeader: Boolean(hmac?.trim()),
      rawBodyChars: rawBody.length,
      shopDomain:
        request.headers.get("X-Shopify-Shop-Domain") ??
        request.headers.get("x-shopify-shop-domain"),
    });
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const topic = (
    request.headers.get("X-Shopify-Topic") ??
    request.headers.get("x-shopify-topic") ??
    ""
  ).trim();
  const topicNorm = topic.toLowerCase().replace(/_/g, "/");
  if (topicNorm !== "refunds/create") {
    console.log("[webhook refunds/create] ignored topic", { topic });
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
    } else {
      const r = extractRefundFromWebhookBody(body);
      console.log("[webhook refunds/create] stored", {
        refundId: r?.id,
        orderId: r?.order_id,
      });
    }
    return new NextResponse("OK", { status: 200 });
  } catch (e) {
    console.error("[webhook refunds/create]", e);
    return new NextResponse("Error", { status: 500 });
  }
}
