import { NextResponse } from "next/server";
import { apiJsonCacheHeaders } from "@/lib/apiCacheHeaders";
import { shopifyAdminGetNoCache } from "@/lib/shopifyAdminApi";
import { runProductCatalogSyncInBackgroundIfStale } from "@/lib/productCatalogBackgroundSync";
import { isShopifyWarehouseDataEnabled } from "@/lib/shopifyWarehouseDayOrders";
import {
  getPickListOrderDayKey,
  getWarehouseDayCreatedAtQueryBoundsUtc,
  isOrderOnWarehouseDay,
  WAREHOUSE_TZ,
} from "@/lib/warehouseLondonDay";
import type { ShopifyOrdersResponse } from "@/types/shopify";

const LOG = "[picklists/debug-delivery-temp]";
const PICK_PAGE_LIM = 250;
const PICK_MAX_PAGES = 32;

type Raw = Record<string, unknown>;

/**
 * **TEMP** — log delivery-related fields to the Next.js dev server terminal, then
 * **delete this file** (or keep behind a private flag) when done.
 * GET: uses pick-list “yesterday” in London, or `?dayKey=YYYY-MM-DD` to test another day.
 */
export async function GET(request: Request) {
  if (!isShopifyWarehouseDataEnabled()) {
    return NextResponse.json(
      { ok: false, error: "SHOPIFY_STORE is not set" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  runProductCatalogSyncInBackgroundIfStale();

  const { searchParams } = new URL(request.url);
  const dayKeyParam = String(searchParams.get("dayKey") ?? "").trim();
  const dayKey = /^\d{4}-\d{2}-\d{2}$/.test(dayKeyParam)
    ? dayKeyParam
    : getPickListOrderDayKey();

  const { createdAtMin, createdAtMax } = getWarehouseDayCreatedAtQueryBoundsUtc(
    dayKey,
  );

  const inDay: Raw[] = [];
  let lastId: number | undefined;
  for (let page = 0; page < PICK_MAX_PAGES; page += 1) {
    const q = new URLSearchParams();
    q.set("status", "any");
    q.set("order", "created_at asc");
    q.set("limit", String(PICK_PAGE_LIM));
    q.set("created_at_min", createdAtMin);
    q.set("created_at_max", createdAtMax);
    if (lastId != null) {
      q.set("since_id", String(lastId));
    }
    const path = `orders.json?${q.toString()}`;
    const { ok, data, status } =
      await shopifyAdminGetNoCache<ShopifyOrdersResponse>(path);
    if (!ok) {
      // eslint-disable-next-line no-console
      console.error(
        LOG,
        "Shopify request failed",
        { status, path, page },
        JSON.stringify((data as unknown) ?? null).slice(0, 500),
      );
      if (inDay.length === 0) {
        return NextResponse.json(
          { ok: false, error: "Shopify orders request failed", status, dayKey },
          { status: 502, headers: { "Cache-Control": "no-store" } },
        );
      }
      break;
    }
    const pageOrders = (data?.orders ?? []) as unknown as Raw[];
    for (const o of pageOrders) {
      const created = new Date(String(o.created_at));
      if (
        Number.isNaN(created.getTime()) ||
        !isOrderOnWarehouseDay(created, dayKey, WAREHOUSE_TZ)
      ) {
        continue;
      }
      const li = o.line_items;
      const withQty = Array.isArray(li)
        ? li.filter(
            (x) =>
              (x as Record<string, unknown>).quantity != null &&
              Number((x as Record<string, unknown>).quantity) > 0,
          )
        : [];
      if (withQty.length === 0) continue;
      inDay.push(o);
    }
    if (pageOrders.length < PICK_PAGE_LIM) break;
    const last = pageOrders[pageOrders.length - 1] as { id?: number };
    if (typeof last?.id !== "number" || !Number.isFinite(last.id)) break;
    lastId = last.id;
  }

  const titleSet = new Set<string>();
  const codeSet = new Set<string>();
  const perOrder: {
    name: string;
    id: number;
    created_at: string;
    shipping_lines: unknown;
    tags: unknown;
    note: unknown;
    note_attributes: unknown;
    line_items: {
      id?: unknown;
      title: unknown;
      name?: unknown;
      sku: unknown;
      properties: unknown;
    }[];
    /** Extra keys we might not type yet */
    source_name: unknown;
    processing_method: unknown;
    reference: unknown;
  }[] = [];

  for (const o of inDay) {
    const shipping = o.shipping_lines;
    if (Array.isArray(shipping)) {
      for (const sl of shipping) {
        const s = (sl as Raw).title;
        if (s != null) titleSet.add(String(s));
        const c = (sl as Raw).code;
        if (c != null && c !== "") codeSet.add(String(c));
      }
    }
    const lineItems = Array.isArray(o.line_items) ? o.line_items : [];
    const lineSlice = lineItems.map((li) => {
      const l = li as Raw;
      return {
        id: l.id,
        title: l.title,
        name: l.name,
        sku: l.sku,
        properties: l.properties,
      };
    });

    const row = {
      name: String(o.name ?? ""),
      id: Number(o.id),
      created_at: String(o.created_at ?? ""),
      shipping_lines: o.shipping_lines,
      tags: o.tags,
      note: o.note,
      note_attributes: o.note_attributes,
      line_items: lineSlice,
      source_name: o.source_name,
      processing_method: o.processing_method,
      reference: o.reference,
    };
    perOrder.push(row);
    // eslint-disable-next-line no-console
    console.log(
      LOG,
      "order",
      row.name,
      "id=" + String(row.id),
    );
    // eslint-disable-next-line no-console
    console.log(LOG, "  shipping_lines:", JSON.stringify(o.shipping_lines, null, 2));
    // eslint-disable-next-line no-console
    console.log(
      LOG,
      "  tags, note, note_attributes, source_name, processing_method, reference:",
      JSON.stringify(
        {
          tags: o.tags,
          note: o.note,
          note_attributes: o.note_attributes,
          source_name: o.source_name,
          processing_method: o.processing_method,
          reference: o.reference,
        },
        null,
        2,
      ),
    );
    // eslint-disable-next-line no-console
    console.log(
      LOG,
      "  line item properties (delivery hints often here):",
      JSON.stringify(
        lineSlice.map((x) => ({ id: x.id, title: x.title, properties: x.properties })),
        null,
        2,
      ),
    );
  }

  // eslint-disable-next-line no-console
  console.log(LOG, "=== dayKey (warehouse London pick-list order day) ===", dayKey);
  // eslint-disable-next-line no-console
  console.log(
    LOG,
    "=== unique shipping_lines.title (",
    String(titleSet.size),
    ")",
  );
  // eslint-disable-next-line no-console
  console.log([...titleSet].sort());
  // eslint-disable-next-line no-console
  console.log(
    LOG,
    "=== unique shipping_lines.code non-empty (",
    String(codeSet.size),
    ")",
  );
  // eslint-disable-next-line no-console
  console.log([...codeSet].sort());

  return NextResponse.json(
    {
      ok: true,
      dayKey,
      dayNote:
        "Same as pick list order day: yesterday in Europe/London unless ?dayKey= is passed.",
      orderCount: inDay.length,
      uniqueShippingLineTitles: [...titleSet].sort(),
      uniqueShippingLineCodes: [...codeSet].sort(),
      orders: perOrder,
    },
    { headers: apiJsonCacheHeaders() },
  );
}
