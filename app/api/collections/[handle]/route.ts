import {
  STOREFRONT_FILTER_SELECTION,
  STOREFRONT_PAGE_INFO,
  STOREFRONT_PRODUCT_CARD_FRAGMENT,
} from "@/lib/storefrontGraphql";
import {
  cacheHeaders,
  STOREFRONT_COLLECTION_CACHE_CONTROL,
} from "@/lib/storefrontCacheHeaders";
import {
  mapCollectionDetail,
  mapStorefrontFilters,
  mapStorefrontProduct,
} from "@/lib/storefrontMappers";
import {
  parseCollectionSort,
  parseFilters,
  parsePagination,
} from "@/lib/storefrontParams";
import {
  storefrontGraphql,
  StorefrontGraphqlError,
} from "@/lib/shopifyStorefront";
import type {
  StorefrontCollectionProductsResponse,
  StorefrontProduct,
} from "@/types/storefront";

type CollectionQueryData = {
  collection: {
    id: string;
    handle: string;
    title: string;
    description: string;
    descriptionHtml: string;
    updatedAt: string;
    image: Record<string, unknown> | null;
    products: {
      filters: unknown[];
      pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor: string | null;
        endCursor: string | null;
      };
      edges: { cursor: string; node: Record<string, unknown> }[];
    };
  } | null;
};

const COLLECTION_QUERY = `
${STOREFRONT_PRODUCT_CARD_FRAGMENT}
${STOREFRONT_FILTER_SELECTION}
${STOREFRONT_PAGE_INFO}
query StorefrontCollectionProducts(
  $handle: String!
  $first: Int!
  $after: String
  $sortKey: ProductCollectionSortKeys!
  $reverse: Boolean!
  $filters: [ProductFilter!]
) {
  collection(handle: $handle) {
    id
    handle
    title
    description
    descriptionHtml
    updatedAt
    image {
      url
      altText
      width
      height
    }
    products(
      first: $first
      after: $after
      sortKey: $sortKey
      reverse: $reverse
      filters: $filters
    ) {
      filters {
        ...StorefrontFilterFields
      }
      pageInfo {
        ...StorefrontPageInfoFields
      }
      edges {
        cursor
        node {
          ...StorefrontProductCard
        }
      }
    }
  }
}
`;

/**
 * `GET /api/collections/:handle` — collection products with Search & Discovery filters,
 * sort, and cursor pagination (Storefront API).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ handle: string }> },
) {
  const { handle: rawHandle } = await context.params;
  const handle = decodeURIComponent(rawHandle ?? "").trim();
  if (!handle) {
    return Response.json(
      { error: "Missing collection handle" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const sp = new URL(request.url).searchParams;
  const { first, after } = parsePagination(sp);
  const { sortKey, reverse } = parseCollectionSort(sp);
  const filters = parseFilters(sp);

  try {
    const data = await storefrontGraphql<CollectionQueryData>(
      COLLECTION_QUERY,
      {
        handle,
        first,
        after: after ?? null,
        sortKey,
        reverse,
        filters: filters.length ? filters : null,
      },
    );

    const col = data.collection;
    if (!col) {
      return Response.json(
        {
          collection: null,
          products: [] as StorefrontProduct[],
          pagination: {
            first,
            pageInfo: {
              hasNextPage: false,
              hasPreviousPage: false,
              startCursor: null,
              endCursor: null,
            },
          },
          filters: [],
          sort: { sortKey, reverse },
        } satisfies StorefrontCollectionProductsResponse,
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const products: StorefrontProduct[] = [];
    for (const edge of col.products.edges ?? []) {
      const p = mapStorefrontProduct(edge.node);
      if (p) products.push(p);
    }

    const body: StorefrontCollectionProductsResponse = {
      collection: mapCollectionDetail(col as Record<string, unknown>),
      products,
      pagination: {
        first,
        pageInfo: col.products.pageInfo,
      },
      filters: mapStorefrontFilters(col.products.filters),
      sort: { sortKey, reverse },
    };

    return Response.json(body, {
      headers: cacheHeaders(STOREFRONT_COLLECTION_CACHE_CONTROL),
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
