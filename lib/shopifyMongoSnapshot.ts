import type {
  ShopifyImage,
  ShopifyOption,
  ShopifyProduct,
  ShopifyVariant,
} from "@/types/shopify";

function s(x: unknown): string {
  if (x == null) return "";
  return String(x);
}

function n(x: unknown, fallback = 0): number {
  const t = Number(x);
  return Number.isFinite(t) ? t : fallback;
}

/**
 * Shapes a REST variant into `ShopifyVariant` for Mongo and in-app use.
 * Extra API fields are dropped; `image_id` is kept for image resolution.
 */
export function toShopifyVariantForMongo(raw: unknown): ShopifyVariant {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    id: n(o.id, 0),
    product_id: n(o.product_id, 0),
    title: s(o.title) || "—",
    price: s(o.price) || "0",
    option1: s(o.option1),
    option2: o.option2 == null || s(o.option2) === "" ? null : s(o.option2),
    option3: o.option3 == null || s(o.option3) === "" ? null : s(o.option3),
    sku: o.sku == null || String(o.sku).trim() === "" ? null : String(o.sku).trim(),
    barcode:
      o.barcode == null || String(o.barcode).trim() === ""
        ? null
        : String(o.barcode).trim(),
    inventory_quantity: Math.max(0, Math.trunc(n(o.inventory_quantity, 0))),
    created_at: s(o.created_at),
    updated_at: s(o.updated_at),
    image_id: typeof o.image_id === "number" && Number.isFinite(o.image_id) ? o.image_id : null,
  };
}

export function toShopifyImageForMongo(raw: unknown): ShopifyImage {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const variantIds = Array.isArray(o.variant_ids)
    ? o.variant_ids.filter(
        (x): x is number => typeof x === "number" && Number.isFinite(x),
      )
    : undefined;
  return {
    id: n(o.id, 0),
    product_id: n(o.product_id, 0),
    src: s(o.src),
    alt: s(o.alt),
    width: Math.max(0, Math.round(n(o.width, 0))),
    height: Math.max(0, Math.round(n(o.height, 0))),
    variant_ids: variantIds && variantIds.length > 0 ? variantIds : undefined,
    position: typeof o.position === "number" && Number.isFinite(o.position) ? o.position : undefined,
    created_at: o.created_at == null ? undefined : s(o.created_at),
    updated_at: o.updated_at == null ? undefined : s(o.updated_at),
  };
}

export function toShopifyOptionForMongo(raw: unknown): ShopifyOption {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const values = Array.isArray(o.values)
    ? o.values.map((v) => String(v ?? ""))
    : [];
  return {
    id: n(o.id, 0),
    product_id: n(o.product_id, 0),
    name: s(o.name) || "—",
    position: n(o.position, 0),
    values,
  };
}

/**
 * Shapes a REST `product` and nested arrays into a single `ShopifyProduct`
 * for Mongo and UI (one canonical shape, extra fields removed).
 */
export function toShopifyProductForMongo(
  raw: unknown,
  options: { variants: ShopifyVariant[]; options: ShopifyOption[]; images: ShopifyImage[]; image: ShopifyImage | undefined },
): ShopifyProduct {
  const p = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    id: n(p.id, 0),
    title: s(p.title) || "—",
    body_html: s(p.body_html),
    vendor: s(p.vendor) || "—",
    product_type: s(p.product_type) || "—",
    created_at: s(p.created_at),
    updated_at: s(p.updated_at),
    published_at: s(p.published_at),
    handle: s(p.handle) || "—",
    tags: s(p.tags),
    status: s(p.status) || "active",
    variants: options.variants,
    options: options.options,
    images: options.images,
    image: options.image,
  };
}
