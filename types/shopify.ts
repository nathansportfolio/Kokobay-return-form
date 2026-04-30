/** REST Admin API: GET /admin/api/{version}/products.json (wrapped list). */
export interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

/** REST Admin API: GET /admin/api/{version}/products/{id}.json */
export interface ShopifySingleProductResponse {
  product: ShopifyProduct;
}

/**
 * Product fields we use in the app and persist in Mongo (Admin REST; may include
 * extra fields at runtime — prefer `toShopifyProductForMongo` when writing).
 */
export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  created_at: string;
  updated_at: string;
  published_at: string;
  handle: string;
  tags: string;
  status: string;

  variants: ShopifyVariant[];
  options: ShopifyOption[];
  images: ShopifyImage[];
  image?: ShopifyImage;
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  /** e.g. `"12.00"` (Shopify `price` string) */
  price: string;

  option1: string;
  option2?: string | null;
  option3?: string | null;

  sku: string | null;
  barcode: string | null;

  inventory_quantity: number;

  created_at: string;
  updated_at: string;
  /**
   * REST-only: links variant to `images` entry; not stored in Mongo if absent.
   * @see `lib/shopifyLineItemImage`, `buildCatalogProductRows`
   */
  image_id?: number | null;
}

export interface ShopifyOption {
  id: number;
  product_id: number;
  name: string;
  position: number;
  values: string[];
}

export interface ShopifyImage {
  id: number;
  product_id: number;
  src: string;
  alt: string;
  width: number;
  height: number;
  /**
   * REST: which variant(s) this image is attached to; not always present on
   * stored documents if stripped.
   */
  variant_ids?: number[];
  position?: number;
  created_at?: string;
  updated_at?: string;
}

/** REST Admin API: GET /admin/api/{version}/orders.json (wrapped list). */
export interface ShopifyOrdersResponse {
  orders: ShopifyOrder[];
}

/**
 * Order resource (subset of REST fields; Shopify may return more at runtime).
 */
export interface ShopifyOrder {
  id: number;
  name: string;
  order_number: number;

  email: string;
  phone: string | null;

  created_at: string;
  updated_at: string;

  currency: string;

  financial_status: string;
  fulfillment_status: string | null;

  total_price: string;
  /** Net total after refunds/adjustments; when lower than `total_price`, money was returned. */
  current_total_price?: string;
  subtotal_price: string;
  total_tax: string;
  total_discounts: string;

  /** Present when Shopify has recorded at least one refund on the order (REST). */
  refunds?: { id?: number }[];

  customer: ShopifyCustomer | null;
  billing_address: ShopifyAddress | null;
  shipping_address: ShopifyAddress | null;

  line_items: ShopifyLineItem[];
  shipping_lines: ShopifyShippingLine[];
}

export interface ShopifyCustomer {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
}

export interface ShopifyAddress {
  first_name: string;
  last_name: string;
  address1: string;
  address2: string | null;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone: string | null;
}

export interface ShopifyLineItem {
  id: number;
  product_id: number;
  variant_id: number;

  /** Full display name on the order line (e.g. `… - white - 12`); not always in thin types. */
  name?: string;
  title: string;
  variant_title: string | null;
  /** Present on REST line items; used for warehouse / returns. */
  sku: string | null;

  /** e.g. `[{ name: "Size", value: "10" }]` on some stores. */
  properties?: { name: string; value: string }[];

  quantity: number;
  price: string;

  vendor: string;
  requires_shipping: boolean;
}

export interface ShopifyShippingLine {
  id: number;
  title: string;
  price: string;
}

/** App-facing order (use in UI, not raw Shopify types). */
export interface Order {
  /** From REST; may lose precision for very large ids — prefer `shopifyOrderId` for URLs. */
  id: number;
  /**
   * String form of Shopify `order.id` for `admin.shopify.com/.../orders/{id}/refund`.
   * Always use this for admin links, not `orderNumber`.
   */
  shopifyOrderId: string;
  orderNumber: number;
  customerName: string;
  email: string;
  total: number;
  items: {
    title: string;
    quantity: number;
    price: number;
  }[];
  createdAt: string;
}
