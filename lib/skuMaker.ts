import { createRequire } from "node:module";

import { fetchAllShopifyProducts } from "@/lib/fetchAllShopifyProducts";
import type { ShopifyProduct, ShopifyVariant } from "@/types/shopify";

const requireFromHere = createRequire(import.meta.url);
const skuRules = requireFromHere("../scripts/merge-sku-rules.js") as {
  safeString: (value: unknown) => string;
  formatVariantWords: (text: unknown) => string;
  isCanonicalSkuFormat: (s: string) => boolean;
  buildDeterministicSkuBase: (
    displayTitle: string,
    titleLower: string,
    colourDisplay: string,
    sizeRaw: string,
  ) => string;
};

const {
  safeString,
  formatVariantWords,
  isCanonicalSkuFormat,
  buildDeterministicSkuBase,
} = skuRules;

const ALL_STATUSES = ["active", "draft", "archived"] as const;

export type SkuMakerProductStatus = (typeof ALL_STATUSES)[number];

export interface SkuMakerSearchHit {
  id: number;
  title: string;
  handle: string;
  status: string;
  vendor: string;
  productType: string;
  variantCount: number;
  imageUrl: string | null;
}

export interface SkuMakerVariantProposal {
  variantId: number;
  /** Option1 (size) — Shopify Admin REST. */
  option1: string;
  /** Option2 (colour) — Shopify Admin REST. */
  option2: string;
  /** Option3 (passthrough). */
  option3: string;
  variantTitle: string;
  /** Existing SKU on the variant (trimmed); null when blank. */
  currentSku: string | null;
  /** True when {@link currentSku} matches the canonical pattern. */
  currentIsCanonical: boolean;
  /**
   * True when {@link currentSku} also appears on a variant of a *different*
   * Shopify product. Highlights real conflicts.
   */
  currentDuplicateOfOther: boolean;
  /** Recommended SKU; deduped against the rest of the shop. */
  proposedSku: string;
  /** True when proposed differs from current (case-insensitive). */
  proposedDiffersFromCurrent: boolean;
  /**
   * Empty when the variant can be assigned a SKU; else explains why none
   * was generated (mirrors the merge-products skip rule).
   */
  skipReason: string;
}

export interface SkuMakerProductResult {
  id: number;
  title: string;
  handle: string;
  status: string;
  vendor: string;
  productType: string;
  imageUrl: string | null;
  /** First-segment display title used by the canonical SKU rules. */
  displayTitle: string;
  variants: SkuMakerVariantProposal[];
  /** Total variants on the product (including ones we skip). */
  variantCount: number;
  /** Count of variants whose proposed SKU differs from current. */
  changeCount: number;
  /** Total SKUs already in use across the rest of the shop (drafts included). */
  existingSkuCount: number;
}

/** Same construction as `merge-products.js` `firstDisplayTitleFromRows`. */
function displayTitleFromProduct(p: ShopifyProduct): string {
  const t = safeString(
    String(p.title ?? "")
      .split(/\s*-\s*/)
      .slice(0, -1)
      .join(" - "),
  );
  if (t) return t;
  return safeString(String(p.handle ?? "").replace(/-/g, " "));
}

function titleLowerFromProduct(p: ShopifyProduct): string {
  const titles = [String(p.title || "").toLowerCase()];
  const handleLower = safeString(p.handle).toLowerCase().replace(/-/g, " ");
  return [...titles, handleLower].join(" ").trim();
}

function variantSizeColorLikeMerge(
  v: Pick<ShopifyVariant, "option1" | "option2">,
  productHandle: string,
): { size: string; color: string; mergeSkipsRow: boolean } {
  const size = safeString(v.option1);
  const option2FromCsv = safeString(v.option2 ?? "");
  let color = option2FromCsv ? formatVariantWords(option2FromCsv) : "Default";
  if (!option2FromCsv && productHandle.includes("-")) {
    const tail = productHandle.split("-").pop() || "";
    if (tail && color.toLowerCase() === "default") {
      color = formatVariantWords(tail);
    }
  }
  const mergeSkipsRow = !size || color.toLowerCase() === "default";
  return { size, color, mergeSkipsRow };
}

function firstImageUrl(p: ShopifyProduct): string | null {
  if (p.image?.src) return p.image.src;
  const i = p.images?.[0]?.src;
  return i ? i : null;
}

/**
 * Cache key segments + revalidate window for the all-statuses fetch. Drafts
 * change rarely, so 30s is fine for collision checks while still feeling
 * live in the SKU Maker UI.
 */
const ALL_PRODUCTS_CACHE_KEY = ["sku-maker", "all-products", "active+draft+archived"] as const;
const ALL_PRODUCTS_REVALIDATE_SEC = 30;

/** In-memory fallback when `unstable_cache` is not desirable (e.g. dynamic). */
let allProductsMemo: { at: number; data: ShopifyProduct[] } | null = null;

async function fetchAllProductsAllStatuses(): Promise<
  | { ok: true; products: ShopifyProduct[] }
  | { ok: false; error: string }
> {
  const now = Date.now();
  if (
    allProductsMemo &&
    now - allProductsMemo.at < ALL_PRODUCTS_REVALIDATE_SEC * 1_000
  ) {
    return { ok: true, products: allProductsMemo.data };
  }
  const r = await fetchAllShopifyProducts({ statuses: [...ALL_STATUSES] });
  if (!r.ok) {
    return r;
  }
  allProductsMemo = { at: now, data: r.products };
  return { ok: true, products: r.products };
}

/**
 * Bust the SKU Maker memo (used by the UI’s “Reload” button so the global
 * collision set picks up Shopify edits without a 30s delay).
 */
export function clearSkuMakerProductCache(): void {
  allProductsMemo = null;
}

void ALL_PRODUCTS_CACHE_KEY;

/**
 * Fetches every product in the shop (active + draft + archived) and returns
 * a memoised snapshot. Shared by search and proposal endpoints so we only
 * pay one Admin API walk per warm window.
 */
export async function loadAllProductsForSkuMaker(): Promise<
  | { ok: true; products: ShopifyProduct[] }
  | { ok: false; error: string }
> {
  return fetchAllProductsAllStatuses();
}

const NORMALIZE_PUNCT = /[,'"\u2018\u2019\u201c\u201d.:/!()[\]{}\-–—_]/g;

function normalizeForSearch(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(NORMALIZE_PUNCT, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchTokens(query: string): string[] {
  const t = query.normalize("NFC").trim();
  if (!t) return [];
  return t
    .toLowerCase()
    .replace(NORMALIZE_PUNCT, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function productSearchText(p: ShopifyProduct): string {
  const variantSkus = (p.variants ?? [])
    .map((v) => String(v.sku ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return normalizeForSearch(
    [
      p.title,
      p.handle ?? "",
      p.vendor ?? "",
      p.product_type ?? "",
      typeof p.tags === "string" ? p.tags : "",
      variantSkus,
      String(p.id),
    ].join(" "),
  );
}

/**
 * Free-text search across `title / handle / variant SKUs / tags / id`.
 * `q === ""` returns the first {@link limit} products (most-recent-first).
 */
export function searchSkuMakerProducts(
  products: ShopifyProduct[],
  q: string,
  limit: number,
): SkuMakerSearchHit[] {
  const cap = Math.max(1, Math.min(200, limit));
  const list = q.trim()
    ? products.filter((p) => {
        const text = productSearchText(p);
        const tokens = searchTokens(q);
        if (tokens.length > 0) {
          return tokens.every((w) => text.includes(w));
        }
        const phrase = normalizeForSearch(q);
        return phrase.length > 0 && text.includes(phrase);
      })
    : [...products].sort((a, b) =>
        String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")),
      );

  return list.slice(0, cap).map((p) => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    status: String(p.status ?? "").toLowerCase(),
    vendor: p.vendor ?? "",
    productType: p.product_type ?? "",
    variantCount: p.variants?.length ?? 0,
    imageUrl: firstImageUrl(p),
  }));
}

/**
 * SKUs already in use **outside** of `excludeProductId` (case-insensitive).
 * Empty/whitespace SKUs are ignored.
 */
function buildExternalSkuSet(
  products: ShopifyProduct[],
  excludeProductId: number,
): {
  /** SKUs from any *other* product in the shop. */
  external: Set<string>;
  /** Multi-product SKU duplicates (key = uppercase SKU, value = count of distinct product ids). */
  productCountBySku: Map<string, Set<number>>;
} {
  const external = new Set<string>();
  const productCountBySku = new Map<string, Set<number>>();
  for (const p of products) {
    for (const v of p.variants ?? []) {
      const sku = String(v.sku ?? "").trim();
      if (!sku) continue;
      const key = sku.toUpperCase();
      if (p.id !== excludeProductId) {
        external.add(key);
      }
      let set = productCountBySku.get(key);
      if (!set) {
        set = new Set<number>();
        productCountBySku.set(key, set);
      }
      set.add(p.id);
    }
  }
  return { external, productCountBySku };
}

/**
 * Builds proposed canonical SKUs for every variant of {@link product}. Mirrors
 * `merge-products.js` rules (canonical pass-through when the existing SKU is
 * canonical; deterministic base from title + colour + size otherwise) and
 * resolves duplicates against the rest of the shop with `-2`, `-3`, … —
 * starting at `-1` to match the historical allocator.
 */
export function proposeSkusForProduct(
  product: ShopifyProduct,
  allProducts: ShopifyProduct[],
): SkuMakerProductResult {
  const displayTitle = displayTitleFromProduct(product);
  const titleLower = titleLowerFromProduct(product);
  const variants = [...(product.variants ?? [])].sort((a, b) =>
    String(a.id).localeCompare(String(b.id), undefined, { numeric: true }),
  );

  const { external, productCountBySku } = buildExternalSkuSet(
    allProducts,
    product.id,
  );

  // Local allocator: pre-seeded with every external SKU so proposals never
  // collide with another product. Among this product’s own variants we still
  // dedup so two variants don’t share a SKU.
  const taken = new Set(external);
  const allocate = (desired: string): string => {
    const base = String(desired ?? "").trim();
    if (!base) return base;
    const upper = base.toUpperCase();
    if (!taken.has(upper)) {
      taken.add(upper);
      return base;
    }
    let n = 1;
    let candidate: string;
    do {
      candidate = `${base}-${n}`;
      n += 1;
    } while (taken.has(candidate.toUpperCase()));
    taken.add(candidate.toUpperCase());
    return candidate;
  };

  const proposals: SkuMakerVariantProposal[] = [];
  let changeCount = 0;

  for (const v of variants) {
    const { size, color, mergeSkipsRow } = variantSizeColorLikeMerge(v, product.handle);
    const rawCurrent = String(v.sku ?? "").trim();
    const currentSku = rawCurrent || null;
    const currentIsCanonical = !!rawCurrent && isCanonicalSkuFormat(rawCurrent);

    const productsUsingCurrent = currentSku
      ? productCountBySku.get(currentSku.toUpperCase()) ?? new Set<number>()
      : new Set<number>();
    const currentDuplicateOfOther =
      currentSku != null &&
      [...productsUsingCurrent].some((pid) => pid !== product.id);

    let proposedSku = "";
    let skipReason = "";

    if (mergeSkipsRow) {
      // Canonical SKU still possible if Shopify already has a perfectly-good one
      // and it is not a duplicate elsewhere — we keep that to avoid noise.
      if (
        currentSku &&
        currentIsCanonical &&
        !currentDuplicateOfOther
      ) {
        proposedSku = allocate(currentSku);
      } else {
        skipReason =
          "No size on Option1 or colour resolves to “Default” — set the variant options first.";
      }
    } else if (
      currentSku &&
      currentIsCanonical &&
      !currentDuplicateOfOther
    ) {
      proposedSku = allocate(currentSku);
    } else {
      const base = buildDeterministicSkuBase(
        displayTitle,
        titleLower,
        color,
        size,
      );
      proposedSku = allocate(base);
    }

    const proposedDiffersFromCurrent =
      proposedSku.length > 0 &&
      (currentSku == null ||
        proposedSku.toUpperCase() !== currentSku.toUpperCase());

    if (proposedSku && proposedDiffersFromCurrent) {
      changeCount += 1;
    }

    proposals.push({
      variantId: v.id,
      option1: size,
      option2: color,
      option3: safeString(v.option3 ?? ""),
      variantTitle: v.title || "",
      currentSku,
      currentIsCanonical,
      currentDuplicateOfOther,
      proposedSku,
      proposedDiffersFromCurrent,
      skipReason,
    });
  }

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    status: String(product.status ?? "").toLowerCase(),
    vendor: product.vendor ?? "",
    productType: product.product_type ?? "",
    imageUrl: firstImageUrl(product),
    displayTitle,
    variants: proposals,
    variantCount: variants.length,
    changeCount,
    existingSkuCount: external.size,
  };
}
