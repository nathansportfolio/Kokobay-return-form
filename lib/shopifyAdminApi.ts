import { unstable_cache } from "next/cache";
import { getShopifyToken } from "@/lib/shopify";

export const SHOPIFY_ADMIN_API_VERSION = "2026-04";

/** Shared cache: 1 minute, keyed by request path. */
const CACHE_REVALIDATE_SEC = 60;

async function shopifyAdminRequest<T>(path: string): Promise<{
  ok: boolean;
  status: number;
  data: T;
  link: string | null;
}> {
  const store = process.env.SHOPIFY_STORE?.trim();
  if (!store) {
    throw new Error("SHOPIFY_STORE is not set");
  }
  const p = path.replace(/^\//, "");
  const token = await getShopifyToken();
  const res = await fetch(
    `https://${store}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/${p}`,
    {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
    },
  );
  const data = (await res.json().catch(() => ({}))) as T;
  return {
    ok: res.ok,
    status: res.status,
    data,
    link: res.headers.get("link"),
  };
}

/**
 * POST JSON to Admin REST (uncached). Use for refunds, calculate, etc.
 */
export async function shopifyAdminPostNoCache<T>(
  path: string,
  body: unknown,
): Promise<{
  ok: boolean;
  status: number;
  data: T;
}> {
  const store = process.env.SHOPIFY_STORE?.trim();
  if (!store) {
    throw new Error("SHOPIFY_STORE is not set");
  }
  const p = path.replace(/^\//, "");
  const token = await getShopifyToken();
  const res = await fetch(
    `https://${store}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/${p}`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

async function shopifyAdminGetImpl<T>(path: string): Promise<{
  ok: boolean;
  status: number;
  data: T;
}> {
  const r = await shopifyAdminRequest<T>(path);
  return { ok: r.ok, status: r.status, data: r.data };
}

/**
 * Same as {@link shopifyAdminGetNoCache} but exposes the response `Link` header
 * for REST cursor pagination (`page_info`).
 */
export async function shopifyAdminGetNoCacheWithLink<T>(path: string): Promise<{
  ok: boolean;
  status: number;
  data: T;
  link: string | null;
}> {
  return shopifyAdminRequest<T>(path);
}

/**
 * GET JSON from Admin REST, uncached — use for one-off lookups (e.g. return form
 * order by number) so results are not stale in the 60s window.
 */
export async function shopifyAdminGetNoCache<T>(path: string): Promise<{
  ok: boolean;
  status: number;
  data: T;
}> {
  return shopifyAdminGetImpl<T>(path);
}

/**
 * GET JSON from Admin REST, e.g. `products.json?limit=250` (no leading slash).
 * Result is cached for 60 seconds (Next.js Data Cache) per `path`.
 */
export async function shopifyAdminGet<T>(path: string): Promise<{
  ok: boolean;
  status: number;
  data: T;
}> {
  return unstable_cache(
    async () => shopifyAdminGetImpl<T>(path),
    ["shopify-rest", path],
    { revalidate: CACHE_REVALIDATE_SEC, tags: ["shopify-admin"] },
  )();
}
