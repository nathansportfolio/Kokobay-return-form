import {
  STOREFRONT_FILTER_SELECTION,
  STOREFRONT_PAGE_INFO,
  STOREFRONT_PRODUCT_CARD_FRAGMENT,
} from "@/lib/storefrontGraphql";
import {
  cacheHeaders,
  STOREFRONT_SEARCH_CACHE_CONTROL,
} from "@/lib/storefrontCacheHeaders";
import {
  mapStorefrontFilters,
  mapStorefrontProduct,
} from "@/lib/storefrontMappers";
import {
  parseFilters,
  parsePagination,
  parseSearchSort,
  parseUnavailableProducts,
} from "@/lib/storefrontParams";
import {
  storefrontGraphql,
  StorefrontGraphqlError,
} from "@/lib/shopifyStorefront";
import type { StorefrontProduct, StorefrontSearchResponse } from "@/types/storefront";

type SearchQueryData = {
  search: {
    totalCount: number;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
    productFilters: unknown[];
    edges: {
      cursor: string;
      node: Record<string, unknown>;
    }[];
  };
};

const SEARCH_QUERY = `
${STOREFRONT_PRODUCT_CARD_FRAGMENT}
${STOREFRONT_FILTER_SELECTION}
${STOREFRONT_PAGE_INFO}
query StorefrontSearch(
  $query: String!
  $first: Int!
  $after: String
  $sortKey: SearchSortKeys
  $reverse: Boolean!
  $productFilters: [ProductFilter!]
  $types: [SearchType!]!
  $unavailableProducts: SearchUnavailableProductsType
) {
  search(
    query: $query
    first: $first
    after: $after
    sortKey: $sortKey
    reverse: $reverse
    productFilters: $productFilters
    types: $types
    unavailableProducts: $unavailableProducts
  ) {
    totalCount
    pageInfo {
      ...StorefrontPageInfoFields
    }
    productFilters {
      ...StorefrontFilterFields
    }
    edges {
      cursor
      node {
        ... on Product {
          ...StorefrontProductCard
        }
      }
    }
  }
}
`;

/**
 * `GET /api/search?q=...` — Storefront `search` (products only), filters, sort, cursor pagination.
 * Cache: short public TTL + SWR for mobile / edge.
 */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const q = (sp.get("q") ?? sp.get("query") ?? "").trim();
  if (!q) {
    return Response.json(
      { error: "Missing required query parameter `q`" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { first, after } = parsePagination(sp);
  const { sortKey, reverse } = parseSearchSort(sp);
  const productFilters = parseFilters(sp);
  const unavailableProducts = parseUnavailableProducts(sp);

  try {
    const data = await storefrontGraphql<SearchQueryData>(SEARCH_QUERY, {
      query: q,
      first,
      after: after ?? null,
      sortKey,
      reverse,
      productFilters: productFilters.length ? productFilters : null,
      types: ["PRODUCT"],
      unavailableProducts,
    });

    const conn = data.search;
    const products: StorefrontProduct[] = [];
    for (const edge of conn.edges ?? []) {
      const p = mapStorefrontProduct(edge.node);
      if (p) products.push(p);
    }

    const body: StorefrontSearchResponse = {
      query: q,
      products,
      totalCount: conn.totalCount,
      pagination: {
        first,
        pageInfo: conn.pageInfo,
      },
      productFilters: mapStorefrontFilters(conn.productFilters),
      sort: { sortKey, reverse: Boolean(reverse) },
      unavailableProducts,
    };

    return Response.json(body, {
      headers: cacheHeaders(STOREFRONT_SEARCH_CACHE_CONTROL),
    });
  } catch (e) {
    if (e instanceof StorefrontGraphqlError) {
      return Response.json(
        { error: e.message, graphqlErrors: e.graphqlErrors },
        { status: e.httpStatus, headers: { "Cache-Control": "no-store" } },
      );
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
