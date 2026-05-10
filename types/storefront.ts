/** Mirrors Shopify Storefront `ProductFilter` input (subset used by this API). */
export type StorefrontProductFilterInput = {
  available?: boolean;
  price?: { min?: number; max?: number };
  productType?: string;
  productVendor?: string;
  tag?: string;
  variantOption?: { name: string; value: string };
};

export type StorefrontMoney = {
  amount: string;
  currencyCode: string;
};

export type StorefrontImage = {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
} | null;

export type StorefrontVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: StorefrontMoney;
  compareAtPrice: StorefrontMoney | null;
  selectedOptions: { name: string; value: string }[];
};

export type StorefrontProduct = {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  tags: string[];
  availableForSale: boolean;
  featuredImage: StorefrontImage;
  priceRange: {
    minVariantPrice: StorefrontMoney;
    maxVariantPrice: StorefrontMoney;
  };
  compareAtPriceRange: {
    minVariantPrice: StorefrontMoney | null;
    maxVariantPrice: StorefrontMoney | null;
  };
  variants: StorefrontVariant[];
};

/** Lightweight product row for predictive / list previews. */
export type StorefrontProductPreview = Pick<
  StorefrontProduct,
  "id" | "title" | "handle" | "vendor" | "availableForSale" | "featuredImage"
> & {
  priceRange: {
    minVariantPrice: StorefrontMoney;
    maxVariantPrice: StorefrontMoney;
  };
};

export type StorefrontCollectionSummary = {
  id: string;
  handle: string;
  title: string;
  image: StorefrontImage;
};

export type StorefrontFilterValue = {
  id: string;
  label: string;
  count: number;
  /** JSON string matching `ProductFilter` — pass back to Shopify as filter input. */
  input: string;
};

export type StorefrontFilter = {
  id: string;
  label: string;
  type: string;
  values: StorefrontFilterValue[];
};

export type StorefrontPageInfo = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
};

export type StorefrontPagination = {
  first: number;
  pageInfo: StorefrontPageInfo;
};

export type StorefrontSearchResponse = {
  query: string;
  products: StorefrontProduct[];
  totalCount: number;
  pagination: StorefrontPagination;
  /** Facets from Shopify Search & Discovery (search query). */
  productFilters: StorefrontFilter[];
  sort: { sortKey: string; reverse: boolean };
  unavailableProducts: string;
};

export type StorefrontPredictiveSuggestion = {
  text: string;
  styledText: string;
};

export type StorefrontPredictiveSearchResponse = {
  query: string;
  products: StorefrontProductPreview[];
  collections: StorefrontCollectionSummary[];
  suggestions: StorefrontPredictiveSuggestion[];
};

export type StorefrontCollectionDetail = {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  updatedAt: string;
  image: StorefrontImage;
};

export type StorefrontCollectionProductsResponse = {
  collection: StorefrontCollectionDetail | null;
  products: StorefrontProduct[];
  pagination: StorefrontPagination;
  filters: StorefrontFilter[];
  sort: { sortKey: string; reverse: boolean };
};
