/** REST Admin API: GET /admin/api/{version}/products.json (wrapped list). */
export interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

/**
 * Product resource (subset aligned with typical REST payloads; Shopify may
 * return extra fields at runtime).
 */
export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  created_at: string;
  handle: string;
  updated_at: string;
  published_at: string | null;
  template_suffix: string | null;
  published_scope: string;
  tags: string;
  status: "active" | "draft" | "archived";
  admin_graphql_api_id: string;

  variants: ShopifyVariant[];
  options: ShopifyOption[];
  images: ShopifyImage[];
  image: ShopifyImage | null;
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  position: number;

  inventory_policy: string;
  compare_at_price: string | null;

  option1: string | null;
  option2: string | null;
  option3: string | null;

  created_at: string;
  updated_at: string;

  taxable: boolean;
  barcode: string | null;

  fulfillment_service: string;

  grams: number;
  inventory_management: string | null;
  requires_shipping: boolean;

  sku: string | null;
  weight: number;
  weight_unit: string;

  inventory_item_id: number;
  inventory_quantity: number;
  old_inventory_quantity: number;

  admin_graphql_api_id: string;
  image_id: number | null;
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
  alt: string | null;
  position: number;
  product_id: number;

  created_at: string;
  updated_at: string;

  width: number;
  height: number;

  src: string;

  variant_ids: number[];
  admin_graphql_api_id: string;
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
  subtotal_price: string;
  total_tax: string;
  total_discounts: string;

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

  title: string;
  variant_title: string | null;
  /** Present on REST line items; used for warehouse / returns. */
  sku: string | null;

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
   * String form of Shopify `order.id` for `admin.shopify.com/.../orders/{id}`.
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
