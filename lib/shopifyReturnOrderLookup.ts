import { shopifyAdminGetNoCache } from "@/lib/shopifyAdminApi";
import type { KokobayOrderLine } from "@/lib/kokobayOrderLines";
import { displaySkuForShopifyLineItem } from "@/lib/shopifyLineItemSku";
import { lineItemTitle } from "@/lib/shopifyLineItemTitle";
import {
  fetchShopifyProductsForLineItemImages,
  lineItemImageUrlsFromProductMap,
} from "@/lib/shopifyLineItemImage";
import { lineSkuForWarehouseUi } from "@/lib/returnLineSkuDisplay";
import { getThumbnailsBySkus } from "@/lib/returnOrderLinesFromProducts";
import type { ShopifyLineItem, ShopifyOrder } from "@/types/shopify";

const LONG_NUMERIC_ID = /^\d{10,}$/;
const SHORT_NUMERIC = /^\d{1,9}$/;

function normalizeOrderNameForShopify(input: string): string {
  const t = input.trim();
  if (!t) return t;
  if (t.startsWith("#")) return t;
  if (SHORT_NUMERIC.test(t) || /^\d+$/.test(t)) {
    return `#${t}`;
  }
  return t;
}

/**
 * Order identity + customer from Shopify (Admin REST) for returns UI: headings,
 * links, and metadata. Always take these from the API, not the URL.
 */
export type ShopifyOrderDisplay = {
  orderName: string;
  /** REST `order.id` — use in admin order URLs. */
  shopifyOrderId: string;
  /** Store’s sequential `order_number` (often what customers use when not using #). */
  shopifyOrderNumber: number;
  email: string;
  customerName: string;
  createdAt: string;
  totalPrice: string;
  currency: string;
  financialStatus: string;
  fulfillmentStatus: string | null;
  /** Count of REST `order.refunds` entries (Shopify can keep `financial_status` as `paid` after a partial refund). */
  refundRecordCount: number;
  /** REST `current_total_price` when present; net after refunds. */
  currentTotalPrice?: string;
};

export function toShopifyOrderDisplay(o: ShopifyOrder): ShopifyOrderDisplay {
  const c = o.customer;
  let customerName = "";
  if (c) {
    customerName = `${c.first_name || ""} ${c.last_name || ""}`.trim();
  }
  if (!customerName && o.shipping_address) {
    customerName =
      `${o.shipping_address.first_name || ""} ${o.shipping_address.last_name || ""}`.trim();
  }
  if (!customerName) customerName = "—";

  const email = String(o.email || c?.email || "")
    .trim();
  const refundRecordCount = Array.isArray(o.refunds) ? o.refunds.length : 0;
  const currentTotalPrice =
    typeof o.current_total_price === "string" && o.current_total_price.trim()
      ? o.current_total_price.trim()
      : undefined;
  return {
    orderName: o.name,
    shopifyOrderId: String(o.id),
    shopifyOrderNumber: o.order_number,
    email,
    customerName,
    createdAt: o.created_at,
    totalPrice: o.total_price,
    currency: o.currency,
    financialStatus: o.financial_status,
    fulfillmentStatus: o.fulfillment_status ?? null,
    refundRecordCount,
    ...(currentTotalPrice ? { currentTotalPrice } : {}),
  };
}

/**
 * Resolve a single Shopify order (same matching rules as line-item fetch) without
 * loading line images — for enriching pages that already have lines (return log, etc.).
 */
export async function fetchShopifyOrderDisplay(
  orderQuery: string,
): Promise<ShopifyOrderDisplay | null> {
  if (!process.env.SHOPIFY_STORE?.trim()) {
    return null;
  }
  const q = orderQuery.trim();
  if (q.length < 1) return null;
  const order = await findShopifyOrderByQuery(q);
  if (!order) return null;
  return toShopifyOrderDisplay(order);
}

/**
 * @internal
 * Exported for unit testing / other callers; prefer {@link fetchReturnOrderFromShopify} or
 * {@link fetchShopifyOrderDisplay}.
 */
export async function findShopifyOrderByQuery(
  orderQuery: string,
): Promise<ShopifyOrder | null> {
  const q = orderQuery.trim();
  if (q.length < 1) {
    return null;
  }
  if (!process.env.SHOPIFY_STORE?.trim()) {
    return null;
  }

  let order: ShopifyOrder | undefined;
  let resolvedViaNumericOrderIdPath = false;

  if (LONG_NUMERIC_ID.test(q)) {
    const r = await shopifyAdminGetNoCache<{ order?: ShopifyOrder }>(
      `orders/${q}.json`,
    );
    if (r.ok && r.data.order) {
      order = r.data.order;
      resolvedViaNumericOrderIdPath = true;
    }
  }

  if (!order) {
    const nameCandidates = [normalizeOrderNameForShopify(q), q]
      .map((s) => s.trim())
      .filter((s, i, a) => s.length > 0 && a.indexOf(s) === i);
    for (const name of nameCandidates) {
      const r = await shopifyAdminGetNoCache<{ orders?: ShopifyOrder[] }>(
        `orders.json?status=any&name=${encodeURIComponent(name)}&limit=20`,
      );
      if (r.ok && r.data.orders?.length) {
        const key = name.toLowerCase();
        order =
          r.data.orders.find((o) => o.name.toLowerCase() === key) ??
          r.data.orders[0];
        if (order) break;
      }
    }
  }

  if (!order && SHORT_NUMERIC.test(q)) {
    const r2 = await shopifyAdminGetNoCache<{ orders?: ShopifyOrder[] }>(
      `orders.json?status=any&order_number=${encodeURIComponent(q)}&limit=5`,
    );
    if (r2.ok && r2.data.orders?.[0]) {
      order = r2.data.orders[0];
    }
  }

  // `orders.json` search hits can omit `refunds` / `current_total_price`; single-order GET is complete.
  if (order?.id && !resolvedViaNumericOrderIdPath) {
    const rFull = await shopifyAdminGetNoCache<{ order?: ShopifyOrder }>(
      `orders/${order.id}.json`,
    );
    if (rFull.ok && rFull.data.order) {
      order = rFull.data.order;
    }
  }

  return order ?? null;
}

/**
 * Fetches a single order from the Shopify Admin API and maps line items to
 * {@link KokobayOrderLine} — images from **Shopify product/variant** (REST),
 * then any remaining gaps from Mongo `products` by SKU.
 */
export type ShopifyReturnOrderResult =
  | (ShopifyOrderDisplay & {
      ok: true;
      orderRef: string;
      lines: KokobayOrderLine[];
    })
  | {
      ok: false;
      error: "not_configured" | "not_found" | "other";
      message?: string;
    };

export async function fetchReturnOrderFromShopify(
  orderQuery: string,
): Promise<ShopifyReturnOrderResult> {
  if (!process.env.SHOPIFY_STORE?.trim()) {
    return { ok: false, error: "not_configured" };
  }

  const q = orderQuery.trim();
  if (q.length < 1) {
    return { ok: false, error: "other", message: "order is required" };
  }

  const order = await findShopifyOrderByQuery(q);
  if (!order) {
    return { ok: false, error: "not_found" };
  }

  const withQty = order.line_items.filter((li) => (li.quantity ?? 0) > 0);
  if (withQty.length === 0) {
    return { ok: false, error: "not_found" };
  }

  const productMap = await fetchShopifyProductsForLineItemImages(
    withQty.map((li) => li.product_id),
  );
  const skus = [
    ...new Set(withQty.map((li) => displaySkuForShopifyLineItem(li))),
  ];
  const shopifyByLine = lineItemImageUrlsFromProductMap(
    withQty,
    productMap,
  );
  const thumbs = await getThumbnailsBySkus(skus);
  const lines: KokobayOrderLine[] = withQty.map((li) => {
    const displaySku = displaySkuForShopifyLineItem(li);
    const lineId = String(li.id);
    const fromShop = shopifyByLine.get(lineId) ?? "";
    const fromMongo = thumbs.get(displaySku) ?? "";
    const imageUrl = (fromShop || fromMongo).trim();
    const price = Math.max(0, Number.parseFloat(String(li.price)) || 0);
    const qty = Math.max(1, Math.trunc(Number(li.quantity) || 0));
    return {
      id: lineId,
      sku: displaySku,
      title: lineItemTitle(li),
      quantity: qty,
      unitPrice: price,
      imageUrl,
    } satisfies KokobayOrderLine;
  });

  const display = toShopifyOrderDisplay(order);
  return {
    ok: true,
    orderRef: order.name,
    lines,
    ...display,
  };
}

/**
 * Fills unit price and image URLs for lines loaded from a customer return form
 * (which only has SKU/title) by matching `KokobayOrderLine.id` to Shopify
 * `line_item.id` and reusing the same product-image logic as
 * {@link fetchReturnOrderFromShopify}. When Mongo has no `products` row for
 * synthetic `V{variant_id}` SKUs, this is the only way images and prices show
 * in the warehouse UI.
 */
export async function enrichKokobayOrderLinesWithShopify(
  orderQuery: string,
  lines: KokobayOrderLine[],
): Promise<KokobayOrderLine[]> {
  if (!process.env.SHOPIFY_STORE?.trim() || lines.length === 0) {
    return lines;
  }
  const order = await findShopifyOrderByQuery(orderQuery);
  if (!order) {
    return lines;
  }
  const withQty = order.line_items.filter((li) => (li.quantity ?? 0) > 0);
  if (withQty.length === 0) {
    return lines;
  }
  const productMap = await fetchShopifyProductsForLineItemImages(
    withQty.map((li) => li.product_id),
  );
  const skus = [
    ...new Set(withQty.map((li) => displaySkuForShopifyLineItem(li))),
  ];
  const shopifyByLine = lineItemImageUrlsFromProductMap(withQty, productMap);
  const mongoThumbs = await getThumbnailsBySkus(skus);
  const byLineItemId = new Map<
    string,
    { unitPrice: number; imageUrl: string; sku: string }
  >();
  for (const li of withQty) {
    const id = String(li.id);
    const displaySku = displaySkuForShopifyLineItem(li);
    const fromShop = shopifyByLine.get(id) ?? "";
    const fromMongo = mongoThumbs.get(displaySku) ?? "";
    const imageUrl = (fromShop || fromMongo).trim();
    const unitPrice = Math.max(
      0,
      Number.parseFloat(String(li.price)) || 0,
    );
    byLineItemId.set(id, { unitPrice, imageUrl, sku: displaySku });
  }
  return lines.map((l) => {
    const s = byLineItemId.get(l.id);
    if (!s) {
      return { ...l, sku: lineSkuForWarehouseUi(l) };
    }
    return {
      ...l,
      unitPrice: s.unitPrice,
      imageUrl: s.imageUrl || l.imageUrl,
      sku: s.sku,
    };
  });
}

/** Strip line payload from a successful return lookup — for page-level metadata. */
export function shopifyOrderDisplayFromLookup(
  s: Extract<ShopifyReturnOrderResult, { ok: true }>,
): ShopifyOrderDisplay {
  const { lines, orderRef, ok, ...display } = s;
  return display;
}

const RETURN_LOG_SHOPIFY_LOOKUP_CONCURRENCY = 5;

/** Shopify REST `financial_status` when the order is fully refunded (live). */
export function shopifyFinancialStatusIsFullyRefunded(
  financialStatus: string | null | undefined,
): boolean {
  return String(financialStatus ?? "").trim().toLowerCase() === "refunded";
}

function shopifyFinancialStatusIsPartiallyRefunded(
  financialStatus: string | null | undefined,
): boolean {
  return (
    String(financialStatus ?? "").trim().toLowerCase() === "partially_refunded"
  );
}

/**
 * True when Shopify shows money has been returned: full/partial financial status,
 * or at least one entry in REST `order.refunds` (some stores keep `paid` after a partial refund).
 */
export function shopifyOrderDisplayIndicatesMoneyReturned(
  d: ShopifyOrderDisplay | null | undefined,
): boolean {
  if (!d) return false;
  if (shopifyFinancialStatusIsFullyRefunded(d.financialStatus)) return true;
  if (shopifyFinancialStatusIsPartiallyRefunded(d.financialStatus)) return true;
  if ((d.refundRecordCount ?? 0) > 0) return true;
  const orig = Number.parseFloat(String(d.totalPrice ?? ""));
  const curRaw = d.currentTotalPrice;
  if (curRaw != null && curRaw !== "") {
    const cur = Number.parseFloat(String(curRaw));
    if (
      !Number.isNaN(orig) &&
      !Number.isNaN(cur) &&
      orig > cur + 0.005
    ) {
      return true;
    }
  }
  return false;
}

/** Human-readable payment column including refund records when status still says “paid”. */
export function shopifyPaymentStatusLabelForReturnsList(
  d: ShopifyOrderDisplay | null | undefined,
): string {
  if (!d) return "—";
  const base = shopifyFinancialStatusLabel(d.financialStatus);
  const n = d.refundRecordCount ?? 0;
  if (
    n > 0 &&
    !shopifyFinancialStatusIsFullyRefunded(d.financialStatus) &&
    !shopifyFinancialStatusIsPartiallyRefunded(d.financialStatus)
  ) {
    return `${base} · ${n} refund record${n === 1 ? "" : "s"}`;
  }
  return base;
}

export function shopifyFinancialStatusLabel(
  financialStatus: string | null | undefined,
): string {
  const s = String(financialStatus ?? "").trim();
  if (!s) return "—";
  return s.replace(/_/g, " ");
}

/**
 * Live order summary per `orderRef` for logged returns (Admin REST). Map keys are
 * `orderRef.trim()`. Values are `null` when Shopify is unavailable or the order was not found.
 */
export async function resolveShopifyOrderDisplaysForOrderRefs(
  orderRefs: string[],
): Promise<Map<string, ShopifyOrderDisplay | null>> {
  const out = new Map<string, ShopifyOrderDisplay | null>();
  if (!process.env.SHOPIFY_STORE?.trim()) return out;
  const unique = [
    ...new Set(
      orderRefs.map((x) => String(x).trim()).filter((x) => x.length > 0),
    ),
  ];
  for (let i = 0; i < unique.length; i += RETURN_LOG_SHOPIFY_LOOKUP_CONCURRENCY) {
    const batch = unique.slice(i, i + RETURN_LOG_SHOPIFY_LOOKUP_CONCURRENCY);
    const settled = await Promise.all(
      batch.map(async (ref) => {
        const d = await fetchShopifyOrderDisplay(ref);
        return { ref, d };
      }),
    );
    for (const { ref, d } of settled) {
      out.set(ref, d ?? null);
    }
  }
  return out;
}
