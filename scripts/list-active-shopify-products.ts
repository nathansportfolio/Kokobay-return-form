/**
 * Lists all **active** Shopify products (Admin REST, paginated; same store as the app).
 *
 * Requires env (e.g. from .env.local):
 *   SHOPIFY_STORE, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET
 *
 * Run from repo root (kokobay/):
 *   pnpm list-active-products
 *   pnpm list-active-products --out ./active-products.json
 *   pnpm list-active-products --csv --out ./active-products.csv
 *   pnpm list-active-products --csv --limit 10 --out ./sample.csv   # first 10 products only (import test)
 *   pnpm list-active-products --format csv   # same if --out path ends in .csv
 *
 * JSON: per product, full `variants[]` plus `options` / `images` / `image`.
 * CSV: one row per variant with **Shopify import-style headings** (`Handle`, `Title`, `Variant SKU`, `Variant ID`, …).
 * `Variant ID` feeds **merge-products** redirects (`Redirect to` … `?variant=`).
 * via `active-products-csv-map.js` — same underlying values as the API (handles unchanged).
 * Extra rows (same Handle, mostly empty fields, `Image Src` only) append images 2…N from the gallery.
 * Variant rows keep full `product_images_src` JSON for merge.
 * Full-detail backup without CSV remains available as JSON (`active-products.json`).
 * `product_collections` is **all** manual collection titles from GraphQL, comma-separated (same order as API merge).
 * In **CSV** export, `product_tags` also includes every collection title (merged, title-cased, deduped); `product_collections` stays as-is for backup/debug.
 * Fetches up to 250 per page and paginates so every membership is retained (not capped at 50).
 */

import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
// @ts-expect-error json2csv has no bundled types
import { Parser, formatters as csvFormatters } from "json2csv";

import { fetchAllShopifyProducts } from "@/lib/fetchAllShopifyProducts";
import { fetchProductCollectionsByProductIds } from "@/lib/fetchShopifyProductCollections";
import { shopifyVariantImageUrl } from "@/lib/shopifyLineItemImage";
import type { ShopifyImage, ShopifyProduct, ShopifyVariant } from "@/types/shopify";

const require = createRequire(fileURLToPath(import.meta.url));
const { SHOPIFY_CSV_FIELDS, rowToShopifyCsv } = require(
  "./active-products-csv-map.js",
) as {
  SHOPIFY_CSV_FIELDS: readonly string[];
  rowToShopifyCsv: (row: Record<string, unknown>) => Record<string, string>;
};

/**
 * Full variant payload from the Admin REST list (TypeScript may omit some keys;
 * index signature keeps extra API fields in the export).
 */
type VariantExport = ShopifyVariant &
  Record<string, unknown> & {
    image_src: string | null;
  };

type Row = {
  id: number;
  title: string;
  handle: string;
  status: string;
  vendor: string;
  product_type: string;
  body_html: string;
  tags: string;
  created_at: string;
  published_at: string | null;
  updated_at: string;
  options: ShopifyProduct["options"];
  image: ShopifyImage | undefined;
  images: ShopifyImage[];
  /** Comma-separated manual collection titles (GraphQL). */
  product_collections: string;
  /** Every variant with all REST fields Shopify returned, plus resolved `image_src`. */
  variants: VariantExport[];
};

/**
 * Deep-clone so we keep every key Shopify sends (not only our TS interface),
 * then set `image_src` using the same fallbacks as the warehouse catalog
 * (variant image → image linked to variant_id → product.image → first image).
 */
function buildVariantExports(
  p: ShopifyProduct,
): VariantExport[] {
  const list = p.variants ?? [];
  return list.map((raw) => {
    const v = JSON.parse(JSON.stringify(raw)) as ShopifyVariant & Record<string, unknown>;
    const url = shopifyVariantImageUrl(p, v.id);
    return {
      ...v,
      image_src: url ? url : null,
    } as VariantExport;
  });
}

/** All unique image URLs for the product, gallery `position` order when present. */
function orderedProductImageSrcs(
  p: Pick<Row, "images" | "image">,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (u: unknown) => {
    const s = String(u ?? "").trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  const imgs = [...(p.images ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  for (const im of imgs) {
    add(im.src);
  }
  if (p.image?.src) {
    add(p.image.src);
  }
  return out;
}

/**
 * CSV must resolve image URL the same way as JSON: `o.image_id` is often null
 * while the CDN URL comes from `product.image` / `images[]`. `shopifyVariantImageUrl`
 * is called again here so the column is never out of sync with the merged object
 * in JSON (and survives any odd key ordering on the variant object).
 */
function productSliceForImageUrl(p: Row): Pick<
  ShopifyProduct,
  "id" | "variants" | "image" | "images"
> {
  return {
    id: p.id,
    variants: p.variants as unknown as ShopifyProduct["variants"],
    image: p.image,
    images: p.images,
  } as Pick<ShopifyProduct, "id" | "variants" | "image" | "images">;
}

function safeString(value: unknown): string {
  return String(value ?? "").trim();
}

/** Title-case words for tag labels (aligned with merge-products). */
function formatTagToken(s: string): string {
  const u = safeString(s);
  if (!u) return "";
  return u
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Dedupe by case-insensitive key; preserves first-seen casing after formatting. */
function buildDedupedTags(parts: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const formatted = formatTagToken(p);
    if (!formatted) continue;
    const key = formatted.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(formatted);
  }
  return out.join(", ");
}

/** Shopify tags + collection titles, normalized and deduped (collections split on "," only). */
function mergeTagsAndCollections(tagsCsv: string, collectionsCsv: string): string {
  const tagParts = tagsCsv
    ? tagsCsv.split(/,\s*/).map((t) => safeString(t)).filter(Boolean)
    : [];
  const collectionParts = collectionsCsv
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  return buildDedupedTags([...tagParts, ...collectionParts]);
}

function productsToCsv(rows: Row[]): { text: string; variantRows: number } {
  const mapped: Record<string, string>[] = [];
  for (const p of rows) {
    const finalTags = mergeTagsAndCollections(
      p.tags ?? "",
      p.product_collections ?? "",
    );
    console.log(
      "EXPORT:",
      p.handle,
      "COLLECTIONS:",
      p.product_collections,
      "TAGS:",
      finalTags,
    );

    const productForImage = productSliceForImageUrl(p);
    const galleryUrls = orderedProductImageSrcs(p);
    const productImagesSrcJson = JSON.stringify(galleryUrls);
    const opts = JSON.stringify(p.options ?? []);

    let variantIndex = 0;
    for (const variant of p.variants) {
      const o = variant as unknown as Record<string, unknown>;
      const variantId = Number(o.id);
      const imageUrl =
        Number.isFinite(variantId) && variantId > 0
          ? shopifyVariantImageUrl(
              { ...productForImage } as ShopifyProduct,
              variantId,
            )
          : (String(o.image_src ?? "").trim() || "");

      const isFirstVariant = variantIndex === 0;
      const imageSrcCell =
        isFirstVariant && galleryUrls.length > 0
          ? galleryUrls[0]
          : isFirstVariant
            ? imageUrl
            : "";

      const flat: Record<string, unknown> = {
        product_handle: p.handle,
        product_title: p.title,
        body_html: p.body_html ?? "",
        product_vendor: p.vendor,
        product_type: p.product_type,
        product_tags: finalTags,
        product_collections: p.product_collections ?? "",
        product_published_at: p.published_at ?? "",
        options_json: opts,
        option1: o.option1 ?? "",
        option2: o.option2 ?? "",
        variant_id:
          Number.isFinite(variantId) && variantId > 0
            ? String(variantId)
            : "",
        sku: o.sku ?? "",
        price: o.price ?? "",
        inventory_quantity: o.inventory_quantity ?? "",
        inventory_management: o.inventory_management ?? "",
        inventory_policy: o.inventory_policy ?? "",
        fulfillment_service: o.fulfillment_service ?? "",
        grams: o.grams ?? "",
        weight: o.weight ?? "",
        weight_unit: o.weight_unit ?? "",
        variant_image: imageUrl,
        image_src_cell: imageSrcCell,
        product_images_src: productImagesSrcJson,
      };
      mapped.push(rowToShopifyCsv(flat));
      variantIndex += 1;
    }

    for (let gi = 1; gi < galleryUrls.length; gi++) {
      mapped.push(
        rowToShopifyCsv({
          product_handle: p.handle,
          variant_image: "",
          image_src_cell: galleryUrls[gi],
          product_images_src: "",
        }),
      );
    }
  }

  const parser = new Parser({
    fields: [...SHOPIFY_CSV_FIELDS],
    withBOM: false,
    delimiter: ",",
    eol: "\n",
    header: true,
    formatters: {
      string: csvFormatters.string({ quote: '"', escapedQuote: '""' }),
    },
  });

  return { text: parser.parse(mapped), variantRows: mapped.length };
}

/** First N products only (variants export expands each). Omit for full catalog. */
function parseProductLimit(): number | null {
  const idx = process.argv.indexOf("--limit");
  if (idx < 0 || !process.argv[idx + 1]) return null;
  const n = Number.parseInt(String(process.argv[idx + 1]).trim(), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

function parseArgs(): {
  outPath: string | null;
  format: "json" | "csv";
} {
  const outIdx = process.argv.indexOf("--out");
  const outPath =
    outIdx >= 0 && process.argv[outIdx + 1] ? process.argv[outIdx + 1] : null;
  const formatIdx = process.argv.indexOf("--format");
  const formatArg = formatIdx >= 0 ? process.argv[formatIdx + 1] : null;
  if (process.argv.includes("--csv")) {
    return { outPath, format: "csv" };
  }
  if (formatArg === "csv" || formatArg === "json") {
    return { outPath, format: formatArg };
  }
  if (outPath?.toLowerCase().endsWith(".csv")) {
    return { outPath, format: "csv" };
  }
  if (outPath?.toLowerCase().endsWith(".json")) {
    return { outPath, format: "json" };
  }
  return { outPath, format: "json" };
}

function main() {
  const { outPath, format } = parseArgs();
  const productLimit = parseProductLimit();

  void (async () => {
    const r = await fetchAllShopifyProducts({ status: "active" });
    if (!r.ok) {
      console.error("Error:", r.error);
      process.exitCode = 1;
      return;
    }
    const products =
      productLimit != null ? r.products.slice(0, productLimit) : r.products;
    if (productLimit != null) {
      console.error(`Limit: first ${products.length} product(s) (of ${r.products.length} active).`);
    }
    console.error("Fetching collection membership (GraphQL)…");
    const collectionsByProductId = await fetchProductCollectionsByProductIds(
      products.map((p) => p.id),
    );
    const rows: Row[] = products.map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      status: p.status,
      vendor: p.vendor,
      product_type: p.product_type,
      body_html: p.body_html,
      tags: p.tags,
      product_collections: collectionsByProductId.get(p.id) ?? "",
      created_at: p.created_at,
      published_at: p.published_at || null,
      updated_at: p.updated_at,
      options: p.options ? JSON.parse(JSON.stringify(p.options)) : [],
      image: p.image != null ? JSON.parse(JSON.stringify(p.image)) : undefined,
      images: p.images ? JSON.parse(JSON.stringify(p.images)) : [],
      variants: buildVariantExports(p),
    }));
    if (format === "csv") {
      const { text, variantRows } = productsToCsv(rows);
      if (outPath) {
        writeFileSync(outPath, text, "utf8");
        console.error(
          `Wrote ${variantRows} variant row(s) from ${rows.length} active product(s) to ${outPath}`,
        );
      } else {
        process.stdout.write(text);
      }
      return;
    }
    const json = `${JSON.stringify(rows, null, 2)}\n`;
    if (outPath) {
      writeFileSync(outPath, json, "utf8");
      console.error(`Wrote ${rows.length} active product(s) to ${outPath}`);
    } else {
      process.stdout.write(json);
    }
  })();
}

main();
