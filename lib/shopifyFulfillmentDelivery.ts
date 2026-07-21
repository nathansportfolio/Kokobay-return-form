import { DateTime } from "luxon";
import { SHOPIFY_ADMIN_API_VERSION } from "@/lib/shopifyAdminApi";
import { getShopifyToken } from "@/lib/shopify";

export type ShopifyFulfillmentDeliveryInfo = {
  /** Earliest carrier/Shopify deliveredAt across fulfillments. */
  deliveredAt: string | null;
  /** Earliest fulfillment createdAt (shipped) across fulfillments. */
  fulfilledAt: string | null;
};

type GqlFulfillmentNode = {
  createdAt?: string | null;
  deliveredAt?: string | null;
  status?: string | null;
};

function earliestIso(values: Array<string | null | undefined>): string | null {
  let best: DateTime | null = null;
  let bestRaw: string | null = null;
  for (const raw of values) {
    const s = String(raw ?? "").trim();
    if (!s) continue;
    const dt = DateTime.fromISO(s);
    if (!dt.isValid) continue;
    if (!best || dt < best) {
      best = dt;
      bestRaw = s;
    }
  }
  return bestRaw;
}

/**
 * Load delivered / fulfilled timestamps for an order from Admin GraphQL.
 * Returns nulls when Shopify has no fulfillments or the query fails.
 */
export async function fetchShopifyFulfillmentDeliveryInfo(
  shopifyOrderId: string | number,
): Promise<ShopifyFulfillmentDeliveryInfo> {
  const empty: ShopifyFulfillmentDeliveryInfo = {
    deliveredAt: null,
    fulfilledAt: null,
  };
  const store = process.env.SHOPIFY_STORE?.trim();
  const id = String(shopifyOrderId ?? "").trim();
  if (!store || !id) return empty;

  try {
    const token = await getShopifyToken();
    const res = await fetch(
      `https://${store}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({
          query: `query ReturnFulfillmentDelivery($id: ID!) {
            order(id: $id) {
              fulfillments(first: 20) {
                createdAt
                deliveredAt
                status
              }
            }
          }`,
          variables: { id: `gid://shopify/Order/${id}` },
        }),
        cache: "no-store",
      },
    );
    const body = (await res.json().catch(() => ({}))) as {
      data?: {
        order?: {
          fulfillments?: GqlFulfillmentNode[] | null;
        } | null;
      };
      errors?: unknown;
    };
    if (!res.ok || body.errors) return empty;

    const fulfillments = body.data?.order?.fulfillments ?? [];
    const deliveredAt = earliestIso(fulfillments.map((f) => f.deliveredAt));
    const fulfilledAt = earliestIso(
      fulfillments
        .filter((f) => {
          const status = String(f.status ?? "").toUpperCase();
          return !status || status === "SUCCESS";
        })
        .map((f) => f.createdAt),
    );

    return { deliveredAt, fulfilledAt };
  } catch (e) {
    console.warn("[return-fulfillment-delivery]", e);
    return empty;
  }
}
