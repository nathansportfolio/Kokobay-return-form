import type { StorefrontProductFilterInput } from "@/types/storefront";

const PAGINATION_DEFAULT_FIRST = 24;
const PAGINATION_MAX_FIRST = 50;

/** URL keys reserved for routing / pagination / sort — not interpreted as filters. */
const RESERVED_SEARCH_PARAM_KEYS = new Set([
  "q",
  "query",
  "sort",
  "first",
  "after",
  "before",
  "last",
  "unavailable",
  "colorOptionName",
  "sizeOptionName",
  "prefix",
]);

export type ParsedPagination = {
  first: number;
  after?: string;
  before?: string;
  last?: number;
};

export function parsePagination(
  searchParams: URLSearchParams,
  defaults?: { first?: number },
): ParsedPagination {
  const defaultFirst = defaults?.first ?? PAGINATION_DEFAULT_FIRST;
  const rawFirst = searchParams.get("first");
  let first = defaultFirst;
  if (rawFirst != null && rawFirst !== "") {
    const n = Number.parseInt(rawFirst, 10);
    if (!Number.isNaN(n) && n > 0) {
      first = Math.min(PAGINATION_MAX_FIRST, n);
    }
  }
  const after = searchParams.get("after") ?? undefined;
  const before = searchParams.get("before") ?? undefined;
  const lastRaw = searchParams.get("last");
  let last: number | undefined;
  if (lastRaw != null && lastRaw !== "") {
    const n = Number.parseInt(lastRaw, 10);
    if (!Number.isNaN(n) && n > 0) {
      last = Math.min(PAGINATION_MAX_FIRST, n);
    }
  }
  return { first, after, before, last };
}

export type SearchSortParsed = {
  sortKey: "RELEVANCE" | "PRICE";
  reverse: boolean;
};

/**
 * Search (`search` query) sort — Storefront 2025-04 supports `RELEVANCE` and `PRICE` only.
 * Aliases: `price_asc`, `price_desc`, `relevance`.
 */
export function parseSearchSort(searchParams: URLSearchParams): SearchSortParsed {
  const raw = (searchParams.get("sort") ?? "relevance").toLowerCase().replace(/-/g, "_");
  if (raw === "price_desc" || raw === "price_descending") {
    return { sortKey: "PRICE", reverse: true };
  }
  if (raw === "price" || raw === "price_asc" || raw === "price_ascending") {
    return { sortKey: "PRICE", reverse: false };
  }
  return { sortKey: "RELEVANCE", reverse: false };
}

export type CollectionSortParsed = {
  sortKey:
    | "COLLECTION_DEFAULT"
    | "BEST_SELLING"
    | "CREATED"
    | "PRICE"
    | "MANUAL"
    | "TITLE";
  reverse: boolean;
};

/**
 * Collection product ordering. Maps friendly query values to `ProductCollectionSortKeys`.
 */
export function parseCollectionSort(
  searchParams: URLSearchParams,
): CollectionSortParsed {
  const raw = (searchParams.get("sort") ?? "featured")
    .toLowerCase()
    .replace(/-/g, "_");

  switch (raw) {
    case "best_selling":
    case "bestselling":
      return { sortKey: "BEST_SELLING", reverse: false };
    case "newest":
    case "created":
      return { sortKey: "CREATED", reverse: true };
    case "price_asc":
    case "price_ascending":
      return { sortKey: "PRICE", reverse: false };
    case "price_desc":
    case "price_descending":
      return { sortKey: "PRICE", reverse: true };
    case "manual":
      return { sortKey: "MANUAL", reverse: false };
    case "title":
      return { sortKey: "TITLE", reverse: false };
    case "featured":
    case "collection_default":
    default:
      return { sortKey: "COLLECTION_DEFAULT", reverse: false };
  }
}

function pushUniqueTag(filters: StorefrontProductFilterInput[], tag: string) {
  const t = tag.trim();
  if (!t) return;
  filters.push({ tag: t });
}

/**
 * Convert URL search params into Storefront `ProductFilter` inputs (AND semantics).
 *
 * Supported:
 * - `color`, `size` → `variantOption` (option names overridable via params or env)
 * - `vendor`, `productType`, `type`
 * - `tag` (repeatable), `tags` (comma-separated)
 * - `minPrice`, `maxPrice`
 * - `available` / `inStock` (`1`, `true`, `yes`)
 * - Any other key → `variantOption` with that key as option name (for custom S&D options)
 */
export function parseFilters(
  searchParams: URLSearchParams,
  options?: { colorOptionName?: string; sizeOptionName?: string },
): StorefrontProductFilterInput[] {
  const filters: StorefrontProductFilterInput[] = [];

  const colorName =
    searchParams.get("colorOptionName")?.trim() ||
    process.env.STOREFRONT_COLOR_OPTION_NAME?.trim() ||
    "Color";
  const sizeName =
    searchParams.get("sizeOptionName")?.trim() ||
    process.env.STOREFRONT_SIZE_OPTION_NAME?.trim() ||
    "Size";

  const color = searchParams.get("color")?.trim();
  if (color) {
    filters.push({ variantOption: { name: colorName, value: color } });
  }
  const size = searchParams.get("size")?.trim();
  if (size) {
    filters.push({ variantOption: { name: sizeName, value: size } });
  }

  const vendor =
    searchParams.get("vendor")?.trim() ||
    searchParams.get("productVendor")?.trim();
  if (vendor) {
    filters.push({ productVendor: vendor });
  }

  const productType =
    searchParams.get("productType")?.trim() ||
    searchParams.get("type")?.trim();
  if (productType) {
    filters.push({ productType });
  }

  for (const tag of searchParams.getAll("tag")) {
    pushUniqueTag(filters, tag);
  }
  for (const t of searchParams.getAll("tags")) {
    for (const part of t.split(",")) {
      pushUniqueTag(filters, part);
    }
  }

  const minRaw = searchParams.get("minPrice");
  const maxRaw = searchParams.get("maxPrice");
  if (minRaw != null || maxRaw != null) {
    const min =
      minRaw != null && minRaw !== ""
        ? Number.parseFloat(minRaw)
        : undefined;
    const max =
      maxRaw != null && maxRaw !== ""
        ? Number.parseFloat(maxRaw)
        : undefined;
    const price: { min?: number; max?: number } = {};
    if (min !== undefined && !Number.isNaN(min)) price.min = min;
    if (max !== undefined && !Number.isNaN(max)) price.max = max;
    if (Object.keys(price).length) {
      filters.push({ price });
    }
  }

  const avail =
    searchParams.get("available") ?? searchParams.get("inStock") ?? "";
  const a = avail.toLowerCase();
  if (a === "1" || a === "true" || a === "yes") {
    filters.push({ available: true });
  } else if (a === "0" || a === "false" || a === "no") {
    filters.push({ available: false });
  }

  for (const [key, value] of searchParams.entries()) {
    if (RESERVED_SEARCH_PARAM_KEYS.has(key)) continue;
    if (
      [
        "color",
        "size",
        "vendor",
        "productVendor",
        "productType",
        "type",
        "tag",
        "tags",
        "minPrice",
        "maxPrice",
        "available",
        "inStock",
      ].includes(key)
    ) {
      continue;
    }
    const v = value?.trim();
    if (!v) continue;
    filters.push({ variantOption: { name: key, value: v } });
  }

  return filters;
}

export type UnavailableProductsMode = "HIDE" | "LAST" | "SHOW";

export function parseUnavailableProducts(
  searchParams: URLSearchParams,
): UnavailableProductsMode {
  const u = (searchParams.get("unavailable") ?? "hide").toLowerCase();
  if (u === "last") return "LAST";
  if (u === "show") return "SHOW";
  return "HIDE";
}

export function parseSortKey(
  scope: "search" | "collection",
  searchParams: URLSearchParams,
): SearchSortParsed | CollectionSortParsed {
  return scope === "search"
    ? parseSearchSort(searchParams)
    : parseCollectionSort(searchParams);
}
