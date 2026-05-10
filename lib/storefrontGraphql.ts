/** Shared Storefront selections — keep fragments in one place for search + collections. */

export const STOREFRONT_PRODUCT_CARD_FRAGMENT = `
fragment StorefrontProductCard on Product {
  id
  title
  handle
  vendor
  tags
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
  compareAtPriceRange {
    minVariantPrice { amount currencyCode }
    maxVariantPrice { amount currencyCode }
  }
  variants(first: 50) {
    edges {
      node {
        id
        title
        availableForSale
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
        selectedOptions { name value }
      }
    }
  }
}
`;

export const STOREFRONT_FILTER_SELECTION = `
fragment StorefrontFilterFields on Filter {
  id
  label
  type
  values {
    id
    label
    count
    input
  }
}
`;

export const STOREFRONT_PAGE_INFO = `
fragment StorefrontPageInfoFields on PageInfo {
  hasNextPage
  hasPreviousPage
  startCursor
  endCursor
}
`;
