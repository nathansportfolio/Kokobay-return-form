import {
  SHOPIFY_ADMIN_API_VERSION,
} from "@/lib/shopifyAdminApi";
import { getShopifyToken } from "@/lib/shopify";

/**
 * Lightweight Admin REST helper for *cart-intelligence* enrichment. Fetches
 * a single variant by id and returns its current `inventory_quantity` so we
 * can attach a fresh stock figure to every pixel event.
 *
 * Why a dedicated helper (instead of `shopifyAdminGet`)?
 *  - We want a hard timeout so analytics ingest never hangs the pixel.
 *  - We dedupe high-frequency reads in-memory (~30s TTL) so a busy variant
 *    doesn’t hit Shopify on every cart event from every visitor.
 *  - We tolerate Shopify being unreachable: a failure does **not** drop the
 *    event — the route falls back to whatever the pixel sent.
 */

const VARIANT_GID_RE = /^gid:\/\/shopify\/ProductVariant\/(\d+)$/i;

/**
 * Accepts numeric (`"9876543210"`), Storefront GID
 * (`"gid://shopify/ProductVariant/9876543210"`), or already-numeric input.
 */
export function parseShopifyVariantId(
  input: string | number | null | undefined,
): number | null {
  if (input == null) return null;
  if (typeof input === "number") {
    return Number.isFinite(input) && input > 0 ? Math.trunc(input) : null;
  }
  const s = String(input).trim();
  if (!s) return null;

  const gid = s.match(VARIANT_GID_RE);
  if (gid) {
    const n = Number.parseInt(gid[1] ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (/^\d+$/.test(s)) {
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

interface ShopifyVariantRestResponse {
  variant?: {
    id: number;
    product_id?: number;
    sku?: string | null;
    title?: string | null;
    inventory_quantity?: number | null;
  };
}

export type VariantInventoryLookupResult =
  | {
      ok: true;
      cached: boolean;
      variantId: number;
      productId: number | null;
      sku: string | null;
      variantTitle: string | null;
      /** `inventory_quantity` from Admin REST; null when Shopify hasn’t set one. */
      inventoryQuantity: number | null;
    }
  | {
      ok: false;
      /** "not_configured" | "invalid_id" | "timeout" | "http_404" | "http_other" | "exception". */
      reason: VariantInventoryLookupErrorReason;
      message: string;
      status?: number;
    };

export type VariantInventoryLookupErrorReason =
  | "not_configured"
  | "invalid_id"
  | "timeout"
  | "http_404"
  | "http_other"
  | "exception";

/** Small in-memory TTL cache (per-process). Cleared automatically after TTL. */
const CACHE_TTL_MS = 30_000;
const variantCache = new Map<
  number,
  { at: number; value: Extract<VariantInventoryLookupResult, { ok: true }> }
>();

function readFromCache(
  variantId: number,
): Extract<VariantInventoryLookupResult, { ok: true }> | null {
  const hit = variantCache.get(variantId);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    variantCache.delete(variantId);
    return null;
  }
  return { ...hit.value, cached: true };
}

function writeToCache(
  variantId: number,
  value: Extract<VariantInventoryLookupResult, { ok: true }>,
): void {
  variantCache.set(variantId, { at: Date.now(), value: { ...value, cached: false } });
  // Cap memory: at ~10k entries we expire the oldest few. Plenty for analytics.
  if (variantCache.size > 10_000) {
    const oldest = [...variantCache.entries()]
      .sort((a, b) => a[1].at - b[1].at)
      .slice(0, 1_000);
    for (const [k] of oldest) variantCache.delete(k);
  }
}

/** Visible for tests / cache busting. */
export function clearShopifyVariantInventoryCache(): void {
  variantCache.clear();
}

const DEFAULT_TIMEOUT_MS = 3_000;

/**
 * Fetch `inventory_quantity` for a single Shopify variant. Caches successful
 * lookups for {@link CACHE_TTL_MS} so a burst of pixel events for the same
 * variant only costs one Admin API call.
 */
export async function fetchShopifyVariantInventory(
  variantIdInput: string | number | null | undefined,
  options?: { timeoutMs?: number },
): Promise<VariantInventoryLookupResult> {
  const variantId = parseShopifyVariantId(variantIdInput);
  if (variantId == null) {
    return {
      ok: false,
      reason: "invalid_id",
      message: "variant_id missing or unparseable",
    };
  }

  const cached = readFromCache(variantId);
  if (cached) return cached;

  const store = process.env.SHOPIFY_STORE?.trim();
  if (!store) {
    return {
      ok: false,
      reason: "not_configured",
      message: "SHOPIFY_STORE is not set",
    };
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const token = await getShopifyToken();
    const url = `https://${store}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/variants/${variantId}.json`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      signal: ac.signal,
      // Don’t let Next’s data cache pin a stale value — analytics needs fresh.
      cache: "no-store",
    });
    if (!res.ok) {
      if (res.status === 404) {
        return {
          ok: false,
          reason: "http_404",
          message: "Variant not found",
          status: 404,
        };
      }
      return {
        ok: false,
        reason: "http_other",
        message: `Shopify Admin returned HTTP ${res.status}`,
        status: res.status,
      };
    }
    const data = (await res.json().catch(() => null)) as
      | ShopifyVariantRestResponse
      | null;
    const v = data?.variant;
    if (!v || typeof v.id !== "number") {
      return {
        ok: false,
        reason: "http_other",
        message: "Shopify Admin response missing `variant`",
        status: res.status,
      };
    }

    const invRaw = v.inventory_quantity;
    const inventoryQuantity =
      typeof invRaw === "number" && Number.isFinite(invRaw)
        ? Math.trunc(invRaw)
        : null;

    const value: Extract<VariantInventoryLookupResult, { ok: true }> = {
      ok: true,
      cached: false,
      variantId: Number(v.id),
      productId:
        typeof v.product_id === "number" && Number.isFinite(v.product_id)
          ? Number(v.product_id)
          : null,
      sku: v.sku ?? null,
      variantTitle: v.title ?? null,
      inventoryQuantity,
    };

    writeToCache(variantId, value);
    return value;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        reason: "timeout",
        message: `Shopify variant lookup timed out after ${timeoutMs}ms`,
      };
    }
    return {
      ok: false,
      reason: "exception",
      message: err instanceof Error ? err.message : "Unknown error",
    };
  } finally {
    clearTimeout(timer);
  }
}
