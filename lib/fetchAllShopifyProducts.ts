import { shopifyAdminGetNoCache } from "@/lib/shopifyAdminApi";
import type { ShopifyProduct, ShopifyProductsResponse } from "@/types/shopify";

const MAX_PAGES = 200;

function coerceProductIdForPagination(id: unknown): number | null {
  if (typeof id === "number" && Number.isFinite(id)) {
    return id;
  }
  if (typeof id === "string" && id.trim() !== "") {
    const n = Number.parseInt(id, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type ShopifyProductStatus = "active" | "archived" | "draft";

export type FetchAllShopifyProductsOptions = {
  /**
   * REST: `status` (Shopify: `active`, `archived`, or `draft`).
   * When omitted, only active products are returned (Shopify REST default).
   */
  status?: ShopifyProductStatus;
  /**
   * REST: comma-separated multiple statuses (e.g. `["active","draft","archived"]`).
   * When set, takes precedence over `status` and is forwarded as `status=active,draft,archived`.
   * Use this to include drafts (e.g. SKU Maker collision check across the whole shop).
   */
  statuses?: ShopifyProductStatus[];
};

/**
 * Walks the Admin REST `products.json` cursor (`since_id`) until no more
 * products (or limit pages). No Next.js data cache.
 */
export async function fetchAllShopifyProducts(
  options?: FetchAllShopifyProductsOptions,
): Promise<
  | { ok: true; products: ShopifyProduct[] }
  | { ok: false; error: string }
> {
  if (!process.env.SHOPIFY_STORE?.trim()) {
    return { ok: false, error: "SHOPIFY_STORE is not set" };
  }
  const statuses = options?.statuses?.filter(Boolean) ?? null;
  const statusFilter = options?.status;
  const statusParam =
    statuses && statuses.length > 0
      ? [...new Set(statuses)].join(",")
      : statusFilter ?? null;
  try {
    const products: ShopifyProduct[] = [];
    let sinceId: number | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const q = new URLSearchParams();
      q.set("limit", "250");
      if (statusParam) {
        q.set("status", statusParam);
      }
      if (sinceId != null) {
        q.set("since_id", String(sinceId));
      }
      const { ok, data, status: httpStatus } =
        await shopifyAdminGetNoCache<ShopifyProductsResponse>(
          `products.json?${q.toString()}`,
        );
      if (!ok) {
        if (products.length === 0) {
          return {
            ok: false,
            error: `Shopify products request failed (HTTP ${httpStatus})`,
          };
        }
        break;
      }
      const batch = data?.products ?? [];
      if (batch.length === 0) {
        break;
      }
      products.push(...batch);
      if (batch.length < 250) {
        break;
      }
      const last = batch[batch.length - 1]!;
      const nextSince = coerceProductIdForPagination(last.id);
      if (nextSince == null) {
        break;
      }
      sinceId = nextSince;
    }
    return { ok: true, products };
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : "Shopify products could not be loaded (token or network error?)";
    return { ok: false, error: message };
  }
}
