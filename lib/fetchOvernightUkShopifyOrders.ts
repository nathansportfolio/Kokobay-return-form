import { DateTime } from "luxon";

import type { OvernightEmailLineItem } from "@/lib/overnightCustomerEmail";
import { shopifyAdminGetNoCacheWithLink } from "@/lib/shopifyAdminApi";
import type { ShopifyLineItem, ShopifyOrder, ShopifyOrdersResponse } from "@/types/shopify";

const LONDON = "Europe/London";
const MAX_PAGES = 80;

export type OvernightUkOrderWindow = {
  timeZone: typeof LONDON;
  /** Inclusive lower bound (London wall clock), ISO with offset. */
  startLocalIso: string;
  /** Inclusive upper bound (London wall clock), ISO with offset. */
  endLocalIso: string;
  /** Same bounds as UTC ISO for Shopify query params. */
  startUtcIso: string;
  endUtcIso: string;
};

export type OvernightUkOrderSummary = {
  /** Shopify REST order id (stable key for saved UI state). */
  shopifyOrderId: string;
  /** Admin-facing order label, e.g. `#1045` (REST `name`). */
  orderName: string;
  customerName: string;
  /** First name when known, else first word of full name, else a safe fallback. */
  greetingName: string;
  email: string;
  items: OvernightEmailLineItem[];
};

/**
 * Orders created from **yesterday 17:00** through **today 08:30** (Europe/London).
 * Intended as the overnight ecommerce window (BST/GMT handled by the zone).
 */
export function getOvernightUkOrderWindow(now: Date = new Date()): OvernightUkOrderWindow {
  const z = DateTime.fromJSDate(now, { zone: LONDON });
  const startLocal = z.minus({ days: 1 }).set({
    hour: 17,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  const endLocal = z.set({
    hour: 8,
    minute: 30,
    second: 0,
    millisecond: 0,
  });
  return {
    timeZone: LONDON,
    startLocalIso: startLocal.toISO()!,
    endLocalIso: endLocal.toISO()!,
    startUtcIso: startLocal.toUTC().toISO()!,
    endUtcIso: endLocal.toUTC().toISO()!,
  };
}

function nextPageInfoFromLinkHeader(link: string | null): string | null {
  if (!link) return null;
  for (const segment of link.split(",")) {
    const m = segment.trim().match(/^<([^>]+)>\s*;\s*rel="next"/i);
    if (m) {
      try {
        return new URL(m[1]).searchParams.get("page_info");
      } catch {
        return null;
      }
    }
  }
  return null;
}

function lineItemDisplayTitle(line: ShopifyLineItem): string {
  const name = line.name?.trim();
  if (name) return name;
  const t = line.title?.trim() ?? "";
  const v = line.variant_title?.trim() ?? "";
  if (t && v) return `${t} — ${v}`;
  return t || v || "Item";
}

function lineItemParts(line: ShopifyLineItem): OvernightEmailLineItem {
  const quantity = Math.max(0, Number(line.quantity) || 0);
  const productTitle = (line.title ?? "").trim() || "Item";
  const props = line.properties ?? [];
  const sizeProp = props.find(
    (p) => String(p.name ?? "").trim().toLowerCase() === "size",
  );
  const sizeVal =
    sizeProp?.value != null ? String(sizeProp.value).trim() : "";
  const vt = (line.variant_title ?? "").trim();
  const isDefaultVariant =
    !vt || /^default title$/i.test(vt) || vt === "Default";
  const size =
    sizeVal.length > 0
      ? sizeVal
      : !isDefaultVariant
        ? vt
        : null;
  return {
    quantity,
    productTitle,
    size,
    displayLine: lineItemDisplayTitle(line),
  };
}

function greetingNameFromOrder(o: ShopifyOrder): string {
  const fn = o.customer?.first_name?.trim();
  if (fn) return fn;
  const full = customerNameFromOrder(o).trim();
  if (!full) return "there";
  const first = full.split(/\s+/)[0];
  return first || "there";
}

function customerNameFromOrder(o: ShopifyOrder): string {
  const c = o.customer;
  if (c) {
    const fn = (c.first_name ?? "").trim();
    const ln = (c.last_name ?? "").trim();
    const full = [fn, ln].filter(Boolean).join(" ");
    if (full) return full;
  }
  const b = o.billing_address;
  if (b) {
    const full = [b.first_name, b.last_name]
      .map((s) => (s ?? "").trim())
      .filter(Boolean)
      .join(" ");
    if (full) return full;
  }
  const s = o.shipping_address;
  if (s) {
    const full = [s.first_name, s.last_name]
      .map((x) => (x ?? "").trim())
      .filter(Boolean)
      .join(" ");
    if (full) return full;
  }
  return "";
}

function emailFromOrder(o: ShopifyOrder): string {
  const direct = o.email?.trim();
  if (direct) return direct;
  return o.customer?.email?.trim() ?? "";
}

function toSummary(o: ShopifyOrder): OvernightUkOrderSummary {
  const items = (o.line_items ?? []).map((li) => lineItemParts(li));
  return {
    shopifyOrderId: String(o.id),
    orderName: (o.name ?? "").trim() || `#${o.order_number}`,
    customerName: customerNameFromOrder(o),
    greetingName: greetingNameFromOrder(o),
    email: emailFromOrder(o),
    items,
  };
}

/**
 * All orders whose `created_at` falls in `[startUtcIso, endUtcIso]` (Shopify REST
 * `created_at_min` / `created_at_max`), paginated via `Link` / `page_info`.
 */
export async function fetchShopifyOrdersCreatedBetweenUtc(params: {
  createdAtMinUtcIso: string;
  createdAtMaxUtcIso: string;
}): Promise<
  | { ok: true; orders: ShopifyOrder[] }
  | { ok: false; error: string; status?: number }
> {
  if (!process.env.SHOPIFY_STORE?.trim()) {
    return { ok: false, error: "SHOPIFY_STORE is not configured" };
  }

  const orders: ShopifyOrder[] = [];
  let pageInfo: string | null = null;
  let isFirst = true;

  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      let path: string;
      if (isFirst) {
        const q = new URLSearchParams();
        q.set("status", "any");
        q.set("limit", "250");
        q.set("created_at_min", params.createdAtMinUtcIso);
        q.set("created_at_max", params.createdAtMaxUtcIso);
        path = `orders.json?${q.toString()}`;
        isFirst = false;
      } else {
        if (!pageInfo) break;
        const q = new URLSearchParams();
        q.set("limit", "250");
        q.set("page_info", pageInfo);
        path = `orders.json?${q.toString()}`;
      }

      const { ok, status, data, link } =
        await shopifyAdminGetNoCacheWithLink<ShopifyOrdersResponse>(path);

      if (!ok) {
        if (orders.length === 0) {
          return {
            ok: false,
            error: "Shopify orders request failed",
            status,
          };
        }
        break;
      }

      const batch = data?.orders ?? [];
      orders.push(...batch);

      pageInfo = nextPageInfoFromLinkHeader(link);
      if (!pageInfo || batch.length === 0) {
        break;
      }
    }

    return { ok: true, orders };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: message };
  }
}

export async function fetchOvernightUkOrderSummaries(
  now?: Date,
): Promise<
  | {
      ok: true;
      window: OvernightUkOrderWindow;
      orders: OvernightUkOrderSummary[];
    }
  | { ok: false; error: string; status?: number }
> {
  const window = getOvernightUkOrderWindow(now);

  const fetched = await fetchShopifyOrdersCreatedBetweenUtc({
    createdAtMinUtcIso: window.startUtcIso,
    createdAtMaxUtcIso: window.endUtcIso,
  });

  if (!fetched.ok) {
    return fetched;
  }

  const excludedOrderNumbers = new Set([
    "58935",
    "58922",
    "58919",
    "58914",
    "58912",
    "58947",
    "58946"
  ]);

  const filteredOrders = fetched.orders
    .filter((o) => {
      const rawName = o.name ?? "";
      const orderNumber = rawName.replace("#", "").split("-")[0].trim();

      const orderName = rawName.toLowerCase();
      const lastName = o.shipping_address?.last_name?.toLowerCase() || "";
      const email = (o.email ?? "").toLowerCase();

      // ❌ Exclude specific orders
      if (excludedOrderNumbers.has(orderNumber)) return false;

      // ❌ Exclude any "test" orders anywhere
      if (orderName.includes("test")) return false;
      if (lastName.includes("test")) return false;
      if (email.includes("test")) return false;

      return true;
    })
    .sort((a, b) => {
      const count = (o: ShopifyOrder) =>
        (o.line_items ?? []).reduce(
          (sum, li) => sum + (Number(li.quantity) || 0),
          0,
        );

      return count(a) - count(b); // least items first
    });

  return {
    ok: true,
    window,
    orders: filteredOrders.map(toSummary),
  };
}


