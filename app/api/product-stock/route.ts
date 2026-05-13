import { apiJsonCacheHeaders } from "@/lib/apiCacheHeaders";
import { loadWarehouseStockByVariantIds } from "@/lib/loadWarehouseStockByVariantIds";
import { insertProductStockLookupLog } from "@/lib/productStockLookupLog";
import { shopifyAdminGet } from "@/lib/shopifyAdminApi";
import type {
  ShopifyProduct,
  ShopifyProductsResponse,
  ShopifyVariant,
} from "@/types/shopify";
import { NextResponse } from "next/server";

function productStockCorsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

function mergeHeaders(...parts: (HeadersInit | undefined)[]): Headers {
  const out = new Headers();

  for (const p of parts) {
    if (!p) continue;

    new Headers(p).forEach((v, k) => out.set(k, v));
  }

  return out;
}

function jsonWithCors(
  body: unknown,
  init?: { status?: number; headers?: HeadersInit },
) {
  const headers = mergeHeaders(
    productStockCorsHeaders(),
    init?.headers,
  );

  return NextResponse.json(body, {
    status: init?.status,
    headers,
  });
}

function positiveVariantId(v: ShopifyVariant): number | undefined {
  const n = Number(v.id);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.trunc(n);
}

/** Admin REST (and Liquid AJAX) may send qty as number or string; .js often omits it entirely. */
function variantInventoryQuantity(v: ShopifyVariant): number | null {
  const raw = (v as { inventory_quantity?: unknown }).inventory_quantity;
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.trunc(n));
}

function isSafeProductHandle(handle: string): boolean {
  const t = handle.trim();

  if (!t || t.length > 256) return false;
  if (t.includes("/") || t.includes("..")) return false;

  return true;
}

function isActiveShopifyProduct(p: ShopifyProduct): boolean {
  return String(p.status ?? "").toLowerCase() === "active";
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: mergeHeaders(productStockCorsHeaders(), {
      "Access-Control-Max-Age": "86400",
    }),
  });
}

/**
 * `GET /api/product-stock` — active product from **Shopify Admin REST** (reliable
 * `inventory_quantity`) merged with warehouse Mongo `stock`. We do not use
 * storefront `products/{handle}.js` for quantities: Shopify often omits
 * `inventory_quantity` there, which surfaces as all-null in the API.
 *
 * Each successful response inserts one audit row in Mongo collection
 * `productStockLookups` (optionally pass `page_url`, UTM params, `fbclid`,
 * `ttclid` on the query string for attribution — stored on the log only).
 */
export async function GET(request: Request) {
  if (!process.env.SHOPIFY_STORE?.trim()) {
    return jsonWithCors(
      { error: "SHOPIFY_STORE is not configured" },
      { status: 500 },
    );
  }

  const requestUrl = new URL(request.url);
  const handle = requestUrl.searchParams.get("handle");

  if (!handle?.trim()) {
    return jsonWithCors(
      { error: "Missing handle" },
      { status: 400 },
    );
  }

  if (!isSafeProductHandle(handle)) {
    return jsonWithCors(
      { error: "Invalid handle" },
      { status: 400 },
    );
  }

  const h = handle.trim();
  const path =
    `products.json?handle=${encodeURIComponent(h)}&limit=1`;

  let ok: boolean;
  let status: number;
  let data: ShopifyProductsResponse;

  try {
    const r = await shopifyAdminGet<ShopifyProductsResponse>(path);
    ok = r.ok;
    status = r.status;
    data = r.data;
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Shopify Admin request failed";
    return jsonWithCors(
      { error: message },
      { status: 500 },
    );
  }

  if (!ok) {
    return jsonWithCors(
      {
        error: "Shopify product request failed",
        status,
      },
      {
        status: status === 404 ? 404 : 502,
      },
    );
  }

  const products = data?.products ?? [];
  const product = products[0];
  if (!product) {
    return jsonWithCors(
      { error: "Product not found" },
      { status: 404 },
    );
  }

  if (!isActiveShopifyProduct(product)) {
    return jsonWithCors(
      { error: "Product not found or not active" },
      { status: 404 },
    );
  }

  const variantsIn = product.variants ?? [];
  if (!Array.isArray(variantsIn) || variantsIn.length === 0) {
    return jsonWithCors(
      { error: "Unexpected product shape" },
      { status: 502 },
    );
  }

  const variantIds = variantsIn
    .map((v) => positiveVariantId(v))
    .filter((id): id is number => id != null);
  const byVariant = await loadWarehouseStockByVariantIds(variantIds);

  const variants = variantsIn.map((v) => {
    const id = positiveVariantId(v);
    const shopifyQty = variantInventoryQuantity(v);
    const wh = id != null ? byVariant.get(id) : undefined;
    if (wh) {
      return {
        id,
        title: v.title ?? "",
        inventory: wh.quantity,
        inventorySource: "warehouse" as const,
        binCode: wh.binCode,
      };
    }
    return {
      id,
      title: v.title ?? "",
      inventory: shopifyQty,
      inventorySource: "shopify" as const,
      binCode: null,
    };
  });

  try {
    const sp = requestUrl.searchParams;
    await insertProductStockLookupLog({
      handle: h,
      shopifyProductId: product.id,
      productTitle: typeof product.title === "string" ? product.title : "",
      variants,
      userAgent: request.headers.get("user-agent"),
      referer: request.headers.get("referer"),
      pageUrl: sp.get("page_url"),
      utmSource: sp.get("utm_source"),
      utmMedium: sp.get("utm_medium"),
      utmCampaign: sp.get("utm_campaign"),
      utmContent: sp.get("utm_content"),
      utmTerm: sp.get("utm_term"),
      fbclid: sp.get("fbclid"),
      ttclid: sp.get("ttclid"),
    });
  } catch (e) {
    console.error("[api/product-stock] lookup log insert failed", e);
  }

  return jsonWithCors(
    {
      id: product.id,
      title:
        typeof product.title === "string"
          ? product.title
          : "",
      variants,
    },
    {
      headers: apiJsonCacheHeaders(),
    },
  );
}
