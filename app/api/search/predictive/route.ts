import {
  cacheHeaders,
  STOREFRONT_PREDICTIVE_CACHE_CONTROL,
} from "@/lib/storefrontCacheHeaders";
import {
  mapCollectionSummary,
  mapPredictiveSuggestions,
  mapStorefrontProductPreview,
} from "@/lib/storefrontMappers";
import { parseUnavailableProducts } from "@/lib/storefrontParams";
import {
  storefrontGraphql,
  StorefrontGraphqlError,
} from "@/lib/shopifyStorefront";
import type {
  StorefrontCollectionSummary,
  StorefrontPredictiveSearchResponse,
  StorefrontProductPreview,
} from "@/types/storefront";

type PredictiveData = {
  predictiveSearch: {
    products: Record<string, unknown>[];
    collections: Record<string, unknown>[];
    queries: { text: string; styledText: string }[];
  } | null;
};

const PREDICTIVE_QUERY = `
query StorefrontPredictive(
  $query: String!
  $limit: Int!
  $types: [PredictiveSearchType!]
  $unavailableProducts: SearchUnavailableProductsType
) {
  predictiveSearch(
    query: $query
    limit: $limit
    types: $types
    unavailableProducts: $unavailableProducts
  ) {
    products {
      id
      handle
      title
      vendor
      availableForSale
      featuredImage {
        url
        altText
        width
        height
      }
      priceRange {
        minVariantPrice { amount currencyCode }
        maxVariantPrice { amount currencyCode }
      }
    }
    collections {
      id
      handle
      title
      image {
        url
        altText
        width
        height
      }
    }
    queries {
      text
      styledText
    }
  }
}
`;

/**
 * `GET /api/search/predictive?q=...` — lightweight type-ahead for mobile.
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

  const limitRaw = sp.get("limit");
  let limit = 8;
  if (limitRaw != null && limitRaw !== "") {
    const n = Number.parseInt(limitRaw, 10);
    if (!Number.isNaN(n)) {
      limit = Math.min(10, Math.max(1, n));
    }
  }
  const unavailableProducts = parseUnavailableProducts(sp);

  try {
    const data = await storefrontGraphql<PredictiveData>(PREDICTIVE_QUERY, {
      query: q,
      limit,
      types: ["PRODUCT", "COLLECTION", "QUERY"],
      unavailableProducts,
    });

    const pr = data.predictiveSearch ?? null;
    const products: StorefrontProductPreview[] = [];
    for (const node of pr?.products ?? []) {
      const p = mapStorefrontProductPreview(node);
      if (p) products.push(p);
    }
    const collections: StorefrontCollectionSummary[] = [];
    for (const c of pr?.collections ?? []) {
      const row = mapCollectionSummary(c);
      if (row) collections.push(row);
    }

    const body: StorefrontPredictiveSearchResponse = {
      query: q,
      products,
      collections,
      suggestions: mapPredictiveSuggestions(pr?.queries),
    };

    return Response.json(body, {
      headers: cacheHeaders(STOREFRONT_PREDICTIVE_CACHE_CONTROL),
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
