import type { Db, Filter } from "mongodb";
import { fetchAllShopifyProducts } from "@/lib/fetchAllShopifyProducts";
import { WAREHOUSE_TZ, calendarDateKeyInTz } from "@/lib/warehouseLondonDay";
import {
  toShopifyImageForMongo,
  toShopifyOptionForMongo,
  toShopifyProductForMongo,
  toShopifyVariantForMongo,
} from "@/lib/shopifyMongoSnapshot";
import {
  SHOPIFY_SYNTHETIC_SKU_PREFIX,
  catalogSkuForVariant,
} from "@/lib/shopifyCanonicalVariantSku";
import type { ShopifyProduct, ShopifyVariant } from "@/types/shopify";

export { SHOPIFY_SYNTHETIC_SKU_PREFIX, catalogSkuForVariant };

const COL = "shopify_product_catalog" as const;
/** Single-doc metadata: feed timestamp, calendar day (London) for “once per day” auto-sync. */
export const SHOPIFY_CATALOG_META_COLLECTION = "shopify_product_catalog_meta" as const;
const CATALOG_META_ID = "singleton" as const;
/** `products` rows we create/update from the Shopify feed (safe to remove when not in feed). */
export const SHOPIFY_PRODUCTS_FEED_SOURCE = "shopify-daily" as const;
/**
 * Placeholder only — **not** a real fixed bin. Used on first insert into
 * `products` so rows exist; pick logic must treat this like “no location yet”
 * (see `shopifyWarehouseDayOrders` / stock `binCode`).
 */
export const DEFAULT_PRODUCT_PLACE_LOCATION = "U-20-F3";

/**
 * Pairs product option names (e.g. Size, Colour) with this variant’s values.
 * Respects `options[].position` order. Skips empty values and “Default Title”.
 */
export function productVariantOptionsForLabel(
  product: Pick<ShopifyProduct, "options">,
  variant: Pick<ShopifyVariant, "option1" | "option2" | "option3">,
): { name: string; value: string }[] {
  const values = [variant.option1, variant.option2, variant.option3] as const;
  const options = [...(product.options ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  const out: { name: string; value: string }[] = [];

  if (options.length > 0) {
    const n = Math.min(3, options.length);
    for (let i = 0; i < n; i++) {
      const v = (values[i] ?? "").trim();
      if (!v) continue;
      if (v.toLowerCase() === "default title") continue;
      const name =
        (options[i]?.name ?? `Option ${String(i + 1)}`).trim() || "Option";
      out.push({ name, value: v });
    }
    if (out.length) return out;
  }

  /** Legacy or thin documents: `options` missing in Mongo; still show size/colour from variant. */
  for (let i = 0; i < 3; i++) {
    const v = (values[i] ?? "").trim();
    if (!v) continue;
    if (v.toLowerCase() === "default title") continue;
    out.push({ name: `Option ${String(i + 1)}`, value: v });
  }
  return out;
}

/**
 * True when a product option is meant to be **colour** (not size, etc.), so we
 * can read the variant’s swatch from the right `option1`–`3` cell.
 */
export function isProductOptionNameForColor(optionName: string): boolean {
  const n = optionName.trim();
  if (!n) return false;
  if (/(colorway|shade|couleur|nuance|farbe|nuanc)/i.test(n)) return true;
  if (/\bcolou?rs?\b/i.test(n)) return true;
  return false;
}

/** e.g. Size, UK, Waist — never use as a swatch/print label. */
export function isProductOptionNameForSize(optionName: string): boolean {
  const n = optionName.trim();
  if (!n) return false;
  if (/(^|\s)(shoe|dress|bust|cup|waist|hip|height|leg|length|inseam|age|kids?)\b/i.test(n)) {
    return true;
  }
  if (/(ring|bag|hat|belt)\s*size|ring\s*size/i.test(n)) return true;
  if (/\b(size|length|width|depth|height|fits|fitting)\b/i.test(n)) return true;
  if (/\b(uk|us|eu)\b/i.test(n) && /\b(size|dress|suit)\b/i.test(n)) return true;
  if (/\bsizes?\b/i.test(n) && n.length < 20) return true;
  if (/^uk$|^us$|^eu$/i.test(n)) return true;
  return false;
}

/** Print / style text used as the visible “swatch” when Colour isn’t set. */
export function isProductOptionNameForStyleOrPrint(optionName: string): boolean {
  const n = optionName.trim();
  if (!n) return false;
  if (/\b(print|pattern|style|look|swatch|design|collection)\b/i.test(n)) {
    return true;
  }
  if (/(material|fabric|finish|denim wash)/i.test(n)) return true;
  return false;
}

/**
 * The variant’s **colour / print** value. Skips size-only tokens (e.g. a
 * mis-tagged `Colour: 6`) and size option rows; also considers Print/Style.
 */
export function variantColorValueFromProductOptions(
  product: Pick<ShopifyProduct, "options">,
  variant: Pick<ShopifyVariant, "option1" | "option2" | "option3">,
): string | null {
  const pairs = productVariantOptionsForLabel(product, variant);
  for (const { name, value } of pairs) {
    if (isProductOptionNameForSize(name)) {
      continue;
    }
    const t = value.trim();
    if (!t || t.toLowerCase() === "default title") {
      continue;
    }
    if (isLikelySizeOnlyToken(t)) {
      continue;
    }
    if (isProductOptionNameForColor(name)) {
      return t;
    }
  }
  for (const { name, value } of pairs) {
    if (isProductOptionNameForSize(name)) {
      continue;
    }
    const t = value.trim();
    if (!t || t.toLowerCase() === "default title" || isLikelySizeOnlyToken(t)) {
      continue;
    }
    if (isProductOptionNameForStyleOrPrint(name)) {
      return t;
    }
  }
  return null;
}

/**
 * Rejects short tokens that are almost always **size**, not a colour, when
 * they appear as the last segment of a product title or a variant option.
 */
export function isLikelySizeOnlyToken(s: string): boolean {
  const u = s.trim();
  if (!u) return true;
  if (u.length > 80) return true;
  if (/^(xxs|xs|s|m|l|xl|xxl|xxxl|os|o\/s|one size|one-size|one size|onesize)$/i.test(u)) {
    return true;
  }
  if (/^(xs|s|m|l|xl|xxl|xxxl)\s*\(\s*[\d-]+\s*\)\s*$/i.test(u)) {
    return true;
  }
  if (/^(\d+\s*[-–]\s*\d+)$/.test(u) && u.length < 20) {
    return true;
  }
  if (/^uk\s*[\d.]+\b/i.test(u) && u.length < 20) {
    return true;
  }
  if (/^us\s*[\d.]+/i.test(u) && u.length < 20) {
    return true;
  }
  if (/^eu\s*[\d.]+/i.test(u) && u.length < 20) {
    return true;
  }
  if (/^[\d.]+$/i.test(u) && u.length < 5) {
    return true;
  }
  return false;
}

/**
 * When colour is not a separate Shopify option, it is often the last segment
 * of the product title after a dash, e.g. `The amara lace top - black`.
 */
/**
 * Picks a colour (or print name) from a **dashed** product/line name.
 * Handles `Name - white - 12` (size last) and `Name - black` (single tail).
 */
export function colorValueFromProductTitleSuffix(title: string): string | null {
  const t = String(title).replace(/\s+/g, " ").trim();
  if (!t) return null;

  const parts = t.split(/\s*[-–—]\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) {
    const m = /[-–—]\s*([^-–—]+?)\s*$/i.exec(t);
    if (m) {
      const tail = m[1]!.trim();
      if (tail && !isLikelySizeOnlyToken(tail) && tail.length <= 100) {
        return tail;
      }
    }
    return null;
  }

  const last = parts[parts.length - 1]!;
  if (!isLikelySizeOnlyToken(last) && last.length <= 100) {
    return last;
  }
  if (isLikelySizeOnlyToken(last) && parts.length >= 2) {
    const prev = parts[parts.length - 2]!;
    if (!isLikelySizeOnlyToken(prev) && prev.length <= 100) {
      if (parts.length === 2 && prev.length > 48) {
        return null;
      }
      return prev;
    }
  }
  for (let i = parts.length - 2; i >= 1; i--) {
    const seg = parts[i]!;
    if (!isLikelySizeOnlyToken(seg) && seg.length <= 100) {
      return seg;
    }
  }
  return null;
}

/**
 * Picks a print / colour from `The maxi (Mocha Melt / 6)`-style `products.name`
 * lines. The slash segment in parens is often `print / size`.
 */
export function colourValueFromLineDisplayName(lineDisplay: string): string | null {
  const t = String(lineDisplay).replace(/\s+/g, " ").trim();
  if (!t) {
    return null;
  }
  const open = t.lastIndexOf("(");
  const close = t.lastIndexOf(")");
  if (open >= 0 && close > open) {
    const inner = t
      .slice(open + 1, close)
      .split(/\s*\/\s*/u)
      .map((s) => s.trim())
      .filter(Boolean);
    if (inner.length >= 2) {
      const last = inner[inner.length - 1]!;
      const first = inner.slice(0, -1).join(" / ");
      if (isLikelySizeOnlyToken(last) && !isLikelySizeOnlyToken(first) && first) {
        return first;
      }
      if (isLikelySizeOnlyToken(first) && !isLikelySizeOnlyToken(last) && last) {
        return last;
      }
    }
    if (inner.length === 1) {
      const s = inner[0]!;
      if (!isLikelySizeOnlyToken(s)) {
        return s;
      }
    }
  }
  return colorValueFromProductTitleSuffix(t);
}

/**
 * Colour for warehouse UI: from Color/Print options; else `(print / size)` in
 * the display name, else dashed product title.
 */
export function variantColorValueForWarehouse(
  product: Pick<ShopifyProduct, "options" | "title">,
  variant: Pick<ShopifyVariant, "option1" | "option2" | "option3" | "title">,
): string | null {
  const fromOptions = variantColorValueFromProductOptions(product, variant);
  if (fromOptions && !isLikelySizeOnlyToken(fromOptions)) {
    return fromOptions;
  }
  return (
    colourValueFromLineDisplayName(variantDisplayName(product, variant)) ??
    colorValueFromProductTitleSuffix(String(product.title ?? ""))
  );
}

export type ProductCatalogEntry = {
  /**
   * Unique in Mongo: Shopify’s barcode/SKU when present, else
   * `KOKO-VAR-{variantId}` (see `SHOPIFY_SYNTHETIC_SKU_PREFIX`).
   */
  sku: string;
  /**
   * Raw Shopify `variant.sku` when the merchant set one; `null` when the row
   * uses the synthetic `KOKO-VAR-*` key. Omitted in older documents.
   */
  shopifySku?: string | null;
  productTitle: string;
  productId: number;
  variantId: number;
  /** Number of variants on the product at sync time. */
  variantCountOnProduct: number;
  syncedAt: Date;
  /**
   * Product snapshot: same for all documents that share `productId`
   * (`shopifyProduct.variants` is the full variant list for that product).
   */
  shopifyProduct: ShopifyProduct;
  /** The variant for this document (same as one entry in `shopifyProduct.variants`). */
  shopifyVariant: ShopifyVariant;
};

export type ShopifyProductCatalogMeta = {
  _id: typeof CATALOG_META_ID;
  /** Wall-clock time when the last successful full sync completed (UTC in Mongo). */
  lastSyncAt: Date;
  /**
   * Warehouse calendar day (Europe/London) of `lastSyncAt`, `YYYY-MM-DD`.
   * Used to skip re-syncing until the next day when the feed is already fresh.
   */
  lastSyncDay: string;
  lastVariantWithSku: number;
  lastCatalogDeleted: number;
  lastProductsUpserted: number;
  lastProductsDeleted: number;
};

function metaCollection(db: Db) {
  return db.collection<ShopifyProductCatalogMeta>(SHOPIFY_CATALOG_META_COLLECTION);
}

export async function getShopifyProductCatalogMeta(
  db: Db,
): Promise<ShopifyProductCatalogMeta | null> {
  return metaCollection(db).findOne({ _id: CATALOG_META_ID });
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function variantThumbUrl(p: ShopifyProduct, v: ShopifyVariant): string {
  if (v.image_id) {
    const im = p.images.find((i) => i.id === v.image_id);
    if (im) return im.src;
  }
  if (p.image) return p.image.src;
  return p.images[0]?.src ?? "";
}

function variantDisplayName(
  p: Pick<ShopifyProduct, "title">,
  v: Pick<ShopifyVariant, "title">,
): string {
  const t = (v.title ?? "").trim();
  if (t && t !== "Default Title") {
    return `${(p.title ?? "").trim() || "—"} (${t})`;
  }
  return (p.title ?? "").trim() || "—";
}

type SyncOk = {
  ok: true;
  count: number;
  withSku: number;
  catalogDeleted: number;
  productsUpserted: number;
  productsDeleted: number;
  lastSyncDay: string;
  /** ISO time of the completed sync (matches metadata `lastSyncAt`). */
  lastSync: string;
};

type SyncResult = SyncOk | { ok: false; error: string };

export type ProductCatalogSyncOptions = {
  /** If false, only updates `shopify_product_catalog` (e.g. rare manual runs). @default true */
  alsoSyncProductsCollection?: boolean;
};

/**
 * Replaces/updates the catalog from Shopify, removes SKUs that no longer exist
 * in the active product feed, and (by default) mirrors the same set into
 * `products` with `feedSource: "shopify-daily"`. Writes
 * `shopify_product_catalog_meta` with a London calendar day for daily skip logic.
 */
export async function runShopifyProductCatalogSync(
  db: Db,
  options: ProductCatalogSyncOptions = {},
): Promise<SyncResult> {
  const { alsoSyncProductsCollection = true } = options;
  const r = await fetchAllShopifyProducts();
  if (!r.ok) {
    return { ok: false, error: r.error };
  }
  const col = db.collection<ProductCatalogEntry>(COL);
  await col.createIndex({ sku: 1 }, { unique: true });
  await col.createIndex({ productTitle: 1 });
  await col.createIndex({ "shopifyProduct.id": 1 });
  await col.createIndex({ "shopifyVariant.id": 1 });
  await col.createIndex({ syncedAt: -1 });

  const productsCol = alsoSyncProductsCollection
    ? db.collection("products")
    : null;
  if (productsCol) {
    await productsCol.createIndex({ sku: 1 });
    await productsCol.createIndex(
      { feedSource: 1, sku: 1 } as { feedSource: 1; sku: 1 },
    );
  }

  const now = new Date();
  const lastSyncDay = calendarDateKeyInTz(now, WAREHOUSE_TZ);
  const allSkus = new Set<string>();
  let variantCount = 0;
  let productsUpserted = 0;

  for (const p of r.products) {
    if (p.status && p.status !== "active") {
      continue;
    }
    const rawVariants = p.variants ?? [];
    const n = rawVariants.length;
    const variantsPicked = rawVariants.map((v) => toShopifyVariantForMongo(v));
    const optionsPicked = (p.options ?? []).map((o) => toShopifyOptionForMongo(o));
    const imagesPicked = (p.images ?? []).map((i) => toShopifyImageForMongo(i));
    const mainPicked = p.image != null ? toShopifyImageForMongo(p.image) : undefined;
    const productPicked = toShopifyProductForMongo(p, {
      variants: variantsPicked,
      options: optionsPicked,
      images: imagesPicked,
      image: mainPicked,
    });
    for (const vPicked of variantsPicked) {
      const d = toCatalogDoc(productPicked, vPicked, n, now);
      if (!d) {
        continue;
      }
      allSkus.add(d.sku);
      await col.replaceOne({ sku: d.sku }, d, { upsert: true });
      variantCount += 1;

      if (productsCol) {
        const rawP = parseFloat(String(vPicked.price ?? "0") || "0");
        const pence = Math.max(
          0,
          Math.round(Number.isFinite(rawP) ? rawP * 100 : 0) || 0,
        );
        const name = variantDisplayName(productPicked, vPicked);
        await productsCol.updateOne(
          { sku: d.sku },
          {
            $set: {
              name,
              category: String(productPicked.product_type ?? "").trim() || "—",
              color: variantColorValueForWarehouse(productPicked, vPicked) || "—",
              thumbnailImageUrl: variantThumbUrl(productPicked, vPicked),
              unitPricePence: pence,
              feedSource: SHOPIFY_PRODUCTS_FEED_SOURCE,
              updatedFromShopifyAt: now,
            } as Record<string, unknown>,
            $setOnInsert: {
              sku: d.sku,
              location: DEFAULT_PRODUCT_PLACE_LOCATION,
              quantityAvailable: 0,
              createdAt: now,
            } as Record<string, unknown>,
          },
          { upsert: true },
        );
        productsUpserted += 1;
      }
    }
  }

  const skuList = [...allSkus];
  let catalogDeleted = 0;
  let productsDeleted = 0;
  if (skuList.length > 0) {
    const cdel = await col.deleteMany({
      sku: { $nin: skuList },
    } as Filter<ProductCatalogEntry>);
    catalogDeleted = cdel.deletedCount;
    if (productsCol) {
      const pdel = await productsCol.deleteMany({
        feedSource: SHOPIFY_PRODUCTS_FEED_SOURCE,
        sku: { $nin: skuList } as { $nin: string[] },
      } as { feedSource: string; sku: { $nin: string[] } });
      productsDeleted = pdel.deletedCount;
    }
  } else {
    // No SKUs in feed — do not nuke Mongo with { $nin: [] }.
    if (r.products.length === 0) {
      // Empty store: clear feed-backed rows only
      const cdel = await col.deleteMany({} as Filter<ProductCatalogEntry>);
      catalogDeleted = cdel.deletedCount;
      if (productsCol) {
        const pdel = await productsCol.deleteMany({
          feedSource: SHOPIFY_PRODUCTS_FEED_SOURCE,
        });
        productsDeleted = pdel.deletedCount;
      }
    }
  }

  const count = await col.countDocuments();

  const meta: Omit<ShopifyProductCatalogMeta, "_id"> = {
    lastSyncAt: now,
    lastSyncDay,
    lastVariantWithSku: variantCount,
    lastCatalogDeleted: catalogDeleted,
    lastProductsUpserted: productsUpserted,
    lastProductsDeleted: productsDeleted,
  };
  await metaCollection(db).updateOne(
    { _id: CATALOG_META_ID },
    { $set: meta, $setOnInsert: { _id: CATALOG_META_ID } },
    { upsert: true },
  );

  return {
    ok: true,
    count,
    withSku: variantCount,
    catalogDeleted,
    productsUpserted,
    productsDeleted,
    lastSyncDay,
    lastSync: now.toISOString(),
  };
}

function toCatalogDoc(
  product: ShopifyProduct,
  variant: ShopifyVariant,
  variantCountOnProduct: number,
  syncedAt: Date,
): ProductCatalogEntry | null {
  if (typeof variant.id !== "number" || !Number.isFinite(variant.id)) {
    return null;
  }
  const { sku, shopifySku } = catalogSkuForVariant(variant);
  return {
    sku,
    shopifySku,
    productTitle: String(product.title ?? "").trim() || "—",
    productId: product.id,
    variantId: variant.id,
    variantCountOnProduct,
    syncedAt,
    shopifyProduct: product,
    shopifyVariant: variant,
  };
}

export type ProductCatalogCountMeta = {
  count: number;
  lastSync: string | null;
  lastSyncDay: string | null;
};

export async function getProductCatalogCountAndLatestSync(
  db: Db,
): Promise<ProductCatalogCountMeta> {
  const col = db.collection<ProductCatalogEntry>(COL);
  const count = await col.countDocuments();
  const m = await getShopifyProductCatalogMeta(db);
  if (m?.lastSyncAt) {
    return {
      count,
      lastSync: m.lastSyncAt.toISOString(),
      lastSyncDay: m.lastSyncDay,
    };
  }
  const latest = await col
    .find()
    .sort({ syncedAt: -1 })
    .limit(1)
    .project({ syncedAt: 1, _id: 0 })
    .toArray();
  return {
    count,
    lastSync: latest[0]?.syncedAt?.toISOString() ?? null,
    lastSyncDay: null,
  };
}

/**
 * If Shopify is enabled and the feed has not been fully synced for the
 * current warehouse day (Europe/London), runs a full feed sync. Safe to
 * call on every pick list load: after the first run each day, further
 * calls are no-ops. On failure, logs and leaves existing data in place.
 */
export async function ensureProductCatalogSyncedForWarehouseDay(
  db: Db,
): Promise<void> {
  if (!process.env.SHOPIFY_STORE?.trim()) {
    return;
  }
  const today = calendarDateKeyInTz(new Date(), WAREHOUSE_TZ);
  const m = await getShopifyProductCatalogMeta(db);
  if (m?.lastSyncDay === today) {
    return;
  }
  const r = await runShopifyProductCatalogSync(db, {
    alsoSyncProductsCollection: true,
  });
  if (!r.ok) {
    console.error(
      "[shopify product catalog] feed sync (pick list gate) failed:",
      r.error,
    );
  }
}

/**
 * @param minLength — when q has fewer chars, return [] (avoids full scan).
 */
export async function searchProductCatalog(
  db: Db,
  options: { q: string; limit: number; minLength?: number },
) {
  const { q, limit, minLength = 1 } = options;
  const t = String(q).trim();
  if (t.length < minLength) {
    return [] as ProductCatalogEntry[];
  }
  const re = new RegExp(escapeRegex(t), "i");
  const col = db.collection<ProductCatalogEntry>(COL);
  return col
    .find(
      {
        $or: [
          { sku: re },
          { productTitle: re },
          { "shopifyProduct.title": re },
          { "shopifyProduct.tags": re },
        ],
      } as Filter<ProductCatalogEntry>,
      { projection: { _id: 0 } },
    )
    .sort({ sku: 1 })
    .limit(Math.min(200, Math.max(1, limit)))
    .toArray();
}

export async function getAllProductCatalog(
  db: Db,
  limit: number = 5_000,
) {
  const col = db.collection<ProductCatalogEntry>(COL);
  return col
    .find({}, { projection: { _id: 0 } })
    .sort({ sku: 1 })
    .limit(Math.min(10_000, limit))
    .toArray();
}

export async function getProductCatalogBySkus(db: Db, skus: string[]) {
  const u = [
    ...new Set(skus.map((s) => String(s).trim()).filter(Boolean)),
  ] as string[];
  if (u.length === 0) return [] as ProductCatalogEntry[];
  const col = db.collection<ProductCatalogEntry>(COL);
  return col
    .find(
      { sku: { $in: u } } as Filter<ProductCatalogEntry>,
      { projection: { _id: 0 } },
    )
    .toArray();
}

export { COL as SHOPIFY_PRODUCT_CATALOG_COLLECTION };

/** Map catalog rows to label sheet rows (one row per included variant). */
export type ProductCatalogLabelRow = {
  sku: string;
  productTitle: string;
  isSimple: boolean;
  productId: number;
  variantId: number;
  /** Option names + values for the label (Size, Colour, etc.). */
  variantOptions: { name: string; value: string }[];
};

/** Map catalog rows to barcode `ProductRow` (same as flatten from Shopify). */
export function catalogEntriesToProductRows(
  items: ProductCatalogEntry[],
  simpleOnly: boolean,
): ProductCatalogLabelRow[] {
  const out: ProductCatalogLabelRow[] = [];
  for (const c of items) {
    if (!c.sku) continue;
    const isSimple = c.variantCountOnProduct === 1;
    if (simpleOnly && !isSimple) {
      continue;
    }
    out.push({
      sku: c.sku,
      productTitle: c.productTitle,
      isSimple,
      productId: c.productId,
      variantId: c.variantId,
      variantOptions:
        c.shopifyVariant == null
          ? []
          : productVariantOptionsForLabel(
              c.shopifyProduct,
              c.shopifyVariant,
            ),
    });
  }
  return out;
}
