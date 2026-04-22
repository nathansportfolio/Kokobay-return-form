/**
 * One catalog row for warehouse UI: Shopify variant × optional Mongo `products` row.
 * Prefer DB for location / stock / colour when the SKU exists and data is valid.
 */
export type CatalogProductRow = {
  /** Stable: used for list keys, e.g. `sp-{productId}-sv-{variantId}`. */
  key: string;
  shopifyProductId: number;
  shopifyVariantId: number;
  sku: string;
  productTitle: string;
  /** Variant option title or variant.title */
  variantTitle: string;
  imageUrl: string;
  priceGbp: number;
  /** `B-04-C3` style, or a generated placeholder. */
  location: string;
  /** Human-readable walk location; empty if we could not parse. */
  locationLine: string;
  /** Bay/shelf/bin style bin digit from parsed location, or "—" */
  bin: string;
  /** Stock units shown in UI. */
  stock: number;
  category: string;
  color: string;
  locationFromDb: boolean;
  /** True if `stock` was taken from Mongo, not only Shopify. */
  stockFromDb: boolean;
  hadMongoMatch: boolean;
};
