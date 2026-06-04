import "server-only";

import { previewOrderEmailMatches } from "@/lib/previewOrderEmailMatch";
import { SHOPIFY_ADMIN_API_VERSION } from "@/lib/shopifyAdminApi";
import { getShopifyToken } from "@/lib/shopify";
import { findShopifyOrderByQuery } from "@/lib/shopifyReturnOrderLookup";
import type { TrackOrderSuccessResponse } from "@/types/trackOrder";

const TRACK_ORDER_GRAPHQL = `
  query TrackOrderFulfillments($id: ID!) {
    order(id: $id) {
      displayFulfillmentStatus
      fulfillments(first: 10) {
        status
        displayStatus
        trackingInfo {
          company
          number
          url
        }
      }
    }
  }
`;

type GqlFulfillment = {
  status?: string | null;
  displayStatus?: string | null;
  trackingInfo?: Array<{
    company?: string | null;
    number?: string | null;
    url?: string | null;
  }> | null;
};

type OrderTrackingEntry = {
  company: string | null;
  number: string | null;
  url: string | null;
};

export function normalizeTrackOrderNumberInput(raw: string): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/^#/, "").trim();
  if (!/^\d+$/.test(digits)) return null;
  return digits;
}

export function formatTrackOrderStatus(raw: string | null | undefined): string {
  const value = String(raw ?? "").trim();
  if (!value) return "Processing";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isTrackOrderOnItsWay(input: {
  fulfillmentStatus: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
}): boolean {
  const status = String(input.fulfillmentStatus ?? "").trim().toUpperCase();
  if (input.trackingNumber?.trim() || input.trackingUrl?.trim()) return true;
  return (
    status.includes("TRANSIT") ||
    status.includes("DELIVER") ||
    status === "FULFILLED" ||
    status === "PARTIALLY_FULFILLED" ||
    status === "PARTIAL"
  );
}

function mapOrderTracking(fulfillments: GqlFulfillment[] | null | undefined): OrderTrackingEntry[] {
  const out: OrderTrackingEntry[] = [];
  const seen = new Set<string>();

  for (const fulfillment of fulfillments ?? []) {
    for (const info of fulfillment.trackingInfo ?? []) {
      const number = String(info.number ?? "").trim() || null;
      const url = String(info.url ?? "").trim() || null;
      const company = String(info.company ?? "").trim() || null;
      if (!number && !url) continue;
      const key = `${company ?? ""}|${number ?? ""}|${url ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ company, number, url });
    }
  }

  return out;
}

/** When Shopify omits a carrier URL (e.g. Evri), derive a public tracking page. */
export function resolveTrackingUrlFallback(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
): string | null {
  const number = String(trackingNumber ?? "").trim();
  if (!number) return null;

  const carrierKey = String(carrier ?? "").trim().toLowerCase();
  if (carrierKey.includes("evri") || carrierKey.includes("hermes")) {
    return `https://www.evri.com/track/#/parcel/${encodeURIComponent(number)}/details`;
  }

  // Evri 16-character barcode when carrier name is missing on the fulfillment.
  if (/^[A-Z0-9]{16}$/i.test(number)) {
    return `https://www.evri.com/track/#/parcel/${encodeURIComponent(number)}/details`;
  }

  return null;
}

function pickPrimaryTracking(tracking: OrderTrackingEntry[]): {
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
} {
  const withNumber = tracking.find((entry) => entry.number?.trim());
  const chosen = withNumber ?? tracking[0] ?? null;
  const trackingNumber = chosen?.number?.trim() || null;
  const carrier = chosen?.company?.trim() || null;
  const urlFromEntry = chosen?.url?.trim() || null;
  const urlFromAny = tracking.find((entry) => entry.url?.trim())?.url?.trim() || null;
  const trackingUrl =
    urlFromEntry ||
    urlFromAny ||
    resolveTrackingUrlFallback(carrier, trackingNumber);

  return {
    carrier,
    trackingNumber,
    trackingUrl,
  };
}

async function fetchOrderTrackingGraphql(shopifyOrderId: number): Promise<{
  fulfillmentStatus: string | null;
  tracking: OrderTrackingEntry[];
}> {
  const store = process.env.SHOPIFY_STORE?.trim();
  if (!store) {
    throw new Error("SHOPIFY_STORE is not set");
  }

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
        query: TRACK_ORDER_GRAPHQL,
        variables: { id: `gid://shopify/Order/${shopifyOrderId}` },
      }),
    },
  );

  const body = (await res.json().catch(() => ({}))) as {
    data?: {
      order?: {
        displayFulfillmentStatus?: string | null;
        fulfillments?: GqlFulfillment[] | null;
      } | null;
    };
    errors?: unknown;
  };

  if (!res.ok || body.errors) {
    throw new Error("Shopify GraphQL fulfillments lookup failed");
  }

  const order = body.data?.order;
  return {
    fulfillmentStatus: order?.displayFulfillmentStatus ?? null,
    tracking: mapOrderTracking(order?.fulfillments),
  };
}

export type TrackOrderLookupResult =
  | { ok: true; data: TrackOrderSuccessResponse }
  | { ok: false; code: "not_configured" | "not_found" | "invalid_input" };

export async function lookupTrackOrder(
  orderNumberInput: string,
  emailInput: string,
): Promise<TrackOrderLookupResult> {
  const orderNumber = normalizeTrackOrderNumberInput(orderNumberInput);
  const email = String(emailInput ?? "").trim();
  if (!orderNumber || !email || !email.includes("@")) {
    return { ok: false, code: "invalid_input" };
  }

  if (!process.env.SHOPIFY_STORE?.trim()) {
    return { ok: false, code: "not_configured" };
  }

  const order = await findShopifyOrderByQuery(`#${orderNumber}`);
  const orderEmail = String(order?.email || order?.customer?.email || "").trim();
  if (!order || !orderEmail || !previewOrderEmailMatches(orderEmail, email)) {
    return { ok: false, code: "not_found" };
  }

  let fulfillmentStatus = order.fulfillment_status ?? null;
  let tracking: OrderTrackingEntry[] = [];

  try {
    const graph = await fetchOrderTrackingGraphql(order.id);
    fulfillmentStatus = graph.fulfillmentStatus ?? fulfillmentStatus;
    tracking = graph.tracking;
  } catch (err) {
    console.warn("[track-order] fulfillments GraphQL failed, using REST status only", err);
  }

  const primary = pickPrimaryTracking(tracking);
  const status = formatTrackOrderStatus(fulfillmentStatus);

  return {
    ok: true,
    data: {
      ok: true,
      orderNumber,
      status,
      onItsWay: isTrackOrderOnItsWay({
        fulfillmentStatus,
        trackingNumber: primary.trackingNumber,
        trackingUrl: primary.trackingUrl,
      }),
      carrier: primary.carrier,
      trackingNumber: primary.trackingNumber,
      trackingUrl: primary.trackingUrl,
    },
  };
}
