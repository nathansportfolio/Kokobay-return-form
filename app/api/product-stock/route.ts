import { apiJsonCacheHeaders } from "@/lib/apiCacheHeaders";
import { NextResponse } from "next/server";

/** Optional: set to your storefront origin (e.g. `https://www.kokobay.co.uk`) instead of `*`. */
function productStockCorsHeaders(request: Request): HeadersInit {
  const fixed = process.env.PRODUCT_STOCK_CORS_ORIGIN?.trim();
  const origin = request.headers.get("Origin");
  if (fixed) {
    if (origin === fixed) {
      return {
        "Access-Control-Allow-Origin": fixed,
        Vary: "Origin",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      };
    }
    return {
      Vary: "Origin",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
  }
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
  request: Request,
  body: unknown,
  init?: { status?: number; headers?: HeadersInit },
) {
  const headers = mergeHeaders(
    productStockCorsHeaders(request),
    init?.headers,
  );
  return NextResponse.json(body, { status: init?.status, headers });
}

type StorefrontProductJsVariant = {
  id?: number;
  title?: string;
  inventory_quantity?: number;
};

type StorefrontProductJs = {
  id?: number;
  title?: string;
  variants?: StorefrontProductJsVariant[];
};

function storefrontProductJsOrigin(): string | null {
  const store = process.env.SHOPIFY_STORE?.trim();
  if (!store) return null;
  const host = store.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  if (!host) return null;
  return `https://${host}`;
}

function isSafeProductHandle(handle: string): boolean {
  const t = handle.trim();
  if (!t || t.length > 256) return false;
  if (t.includes("/") || t.includes("..")) return false;
  return true;
}

/**
 * `GET /api/product-stock?handle=...` — variant IDs, titles, and storefront
 * `inventory_quantity` from Shopify’s public `products/{handle}.js` endpoint.
 *
 * Requires `SHOPIFY_STORE` (same host as storefront `.js` routes).
 *
 * CORS: enabled for browser calls from other origins (e.g. Shopify theme).
 * Set `PRODUCT_STOCK_CORS_ORIGIN` to a single storefront origin to restrict
 * `Access-Control-Allow-Origin` instead of `*`.
 */
export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: mergeHeaders(productStockCorsHeaders(request), {
      "Access-Control-Max-Age": "86400",
    }),
  });
}

export async function GET(request: Request) {
  const origin = storefrontProductJsOrigin();
  if (!origin) {
    return jsonWithCors(
      request,
      { error: "SHOPIFY_STORE is not configured" },
      { status: 500 },
    );
  }

  const handle = new URL(request.url).searchParams.get("handle");
  if (!handle?.trim()) {
    return jsonWithCors(request, { error: "Missing handle" }, { status: 400 });
  }
  if (!isSafeProductHandle(handle)) {
    return jsonWithCors(request, { error: "Invalid handle" }, { status: 400 });
  }

  const url = `${origin}/products/${encodeURIComponent(handle.trim())}.js`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fetch failed";
    return jsonWithCors(request, { error: message }, { status: 502 });
  }

  if (!res.ok) {
    return jsonWithCors(
      request,
      { error: "Product request failed", status: res.status },
      { status: res.status === 404 ? 404 : 502 },
    );
  }

  let product: unknown;
  try {
    product = await res.json();
  } catch {
    return jsonWithCors(
      request,
      { error: "Invalid product JSON" },
      { status: 502 },
    );
  }

  const p = product as StorefrontProductJs;
  if (typeof p.id !== "number" || !Array.isArray(p.variants)) {
    return jsonWithCors(
      request,
      { error: "Unexpected product shape" },
      { status: 502 },
    );
  }

  const variants = p.variants.map((v) => ({
    id: v.id,
    title: v.title ?? "",
    inventory:
      typeof v.inventory_quantity === "number" ? v.inventory_quantity : null,
  }));

  return jsonWithCors(
    request,
    {
      id: p.id,
      title: typeof p.title === "string" ? p.title : "",
      variants,
    },
    { headers: apiJsonCacheHeaders() },
  );
}
