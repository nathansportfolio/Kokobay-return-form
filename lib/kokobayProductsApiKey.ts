/**
 * Optional header for clients that still send a shared secret.
 * **`GET /api/products` is unauthenticated** — PIN middleware + Shopify Admin env protect the site.
 */
export const KOKOBAY_PRODUCTS_API_KEY_HEADER = "x-kokobay-products-api-key";
