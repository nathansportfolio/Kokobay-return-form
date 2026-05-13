
import { apiJsonCacheHeaders } from "@/lib/apiCacheHeaders";
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

  const host = store
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");

  if (!host) return null;

  return `https://${host}`;
}

function isSafeProductHandle(handle: string): boolean {
  const t = handle.trim();

  if (!t || t.length > 256) return false;
  if (t.includes("/") || t.includes("..")) return false;

  return true;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: mergeHeaders(productStockCorsHeaders(), {
      "Access-Control-Max-Age": "86400",
    }),
  });
}

export async function GET(request: Request) {
  const origin = storefrontProductJsOrigin();

  if (!origin) {
    return jsonWithCors(
      { error: "SHOPIFY_STORE is not configured" },
      { status: 500 },
    );
  }

  const handle = new URL(request.url)
    .searchParams
    .get("handle");

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

  const url =
    `${origin}/products/${encodeURIComponent(handle.trim())}.js`;

  let res: Response;

  try {
    res = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      next: {
        revalidate: 60,
      },
    });
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : "Fetch failed";

    return jsonWithCors(
      { error: message },
      { status: 502 },
    );
  }

  if (!res.ok) {
    return jsonWithCors(
      {
        error: "Product request failed",
        status: res.status,
      },
      {
        status: res.status === 404 ? 404 : 502,
      },
    );
  }

  let product: unknown;

  try {
    product = await res.json();
  } catch {
    return jsonWithCors(
      { error: "Invalid product JSON" },
      { status: 502 },
    );
  }

  const p = product as StorefrontProductJs;

  if (
    typeof p.id !== "number" ||
    !Array.isArray(p.variants)
  ) {
    return jsonWithCors(
      { error: "Unexpected product shape" },
      { status: 502 },
    );
  }

  const variants = p.variants.map((v) => ({
    id: v.id,
    title: v.title ?? "",
    inventory:
      typeof v.inventory_quantity === "number"
        ? v.inventory_quantity
        : null,
  }));

  return jsonWithCors(
    {
      id: p.id,
      title:
        typeof p.title === "string"
          ? p.title
          : "",
      variants,
    },
    {
      headers: apiJsonCacheHeaders(),
    },
  );
}

