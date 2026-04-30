import { shopifyAdminGetNoCache } from "@/lib/shopifyAdminApi";
import type { ShopifyProduct, ShopifyProductsResponse } from "@/types/shopify";

const MAX_PAGES = 200;

export type FetchAllShopifyProductsOptions = {
  /**
   * REST: `status` (Shopify: `active`, `archived`, or `draft`).
   * When omitted, all statuses are returned (API default).
   */
  status?: "active" | "archived" | "draft";
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
  const statusFilter = options?.status;
  try {
    const products: ShopifyProduct[] = [];
    let sinceId: number | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const q = new URLSearchParams();
      q.set("limit", "250");
      if (statusFilter) {
        q.set("status", statusFilter);
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
      if (typeof last.id !== "number" || !Number.isFinite(last.id)) {
        break;
      }
      sinceId = last.id;
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
