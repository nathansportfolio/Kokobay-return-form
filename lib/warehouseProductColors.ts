import type { Db } from "mongodb";
import {
  productVariantOptionsForLabel,
  SHOPIFY_PRODUCT_CATALOG_COLLECTION,
  type ProductCatalogEntry,
  variantColorValueForWarehouse,
} from "@/lib/shopifyProductCatalog";

/**
 * Apparel / common name → sRGB hex for map / legend chips.
 * Keys are lowercased, trimmed, ASCII; match before falling back to hash.
 */
const KNOWN_HEX: Readonly<Record<string, string>> = {
  black: "#1a1a1a",
  white: "#f5f5f4",
  ivory: "#fffff0",
  cream: "#fffdd0",
  "off white": "#f2f0e6",
  offwhite: "#f2f0e6",
  grey: "#9ca3af",
  gray: "#9ca3af",
  charcoal: "#3d3d3d",
  silver: "#c0c0c0",
  red: "#dc2626",
  crimson: "#b91c1c",
  burgundy: "#7f1d1d",
  maroon: "#5c1f1f",
  pink: "#f472b6",
  blush: "#fecdd3",
  rose: "#fb7185",
  coral: "#ff7f50",
  orange: "#f97316",
  amber: "#f59e0b",
  gold: "#ca8a04",
  yellow: "#eab308",
  lime: "#84cc16",
  green: "#16a34a",
  sage: "#86a17a",
  olive: "#6b7c3d",
  teal: "#0d9488",
  turquoise: "#2dd4bf",
  blue: "#2563eb",
  navy: "#1e3a5f",
  "navy blue": "#1e3a5f",
  indigo: "#4f46e5",
  purple: "#9333ea",
  violet: "#7c3aed",
  brown: "#92400e",
  tan: "#d2b48c",
  beige: "#d4c4a8",
  khaki: "#c3b091",
  "multi": "#6b7280",
  "multi colour": "#6b7280",
  "multicolour": "#6b7280",
  "multicolor": "#6b7280",
  assorted: "#6b7280",
  clear: "#e0f2fe",
  natural: "#d4c4a8",
  denim: "#3b5f8a",
};

function hash32(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/**
 * HSL (deg, 0–100, 0–100) → `#rrggbb`.
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const to = (n: number) =>
    Math.round(255 * (n + m))
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * A stable, screen-friendly fill colour for a product colour **label** (e.g. from
 * `products.color`, Shopify options). Unlisted names get a saturated mid-tone
 * from a deterministic hash so the map stays legible.
 */
export function hexForProductColorName(raw: string): string {
  const t = String(raw).trim();
  if (!t || t === "—") return "#a1a1aa";

  const key = t.toLowerCase().replace(/[’'"]/g, "").replace(/\s+/g, " ");
  if (KNOWN_HEX[key]) return KNOWN_HEX[key]!;

  const firstToken = key.split(/[/·|,]+/)[0]?.trim() ?? key;
  if (firstToken !== key && KNOWN_HEX[firstToken]) {
    return KNOWN_HEX[firstToken]!;
  }

  // e.g. "Milkshake Pink" → "pink" (not in `KNOWN_HEX` as a full string). Without
  // this we fall back to a hash → arbitrary hue, so a pink label can show a blue
  // dot. Prefer longest **suffix** that matches a known name ("navy blue" before
  // "blue").
  const words = key.split(/\s+/).filter(Boolean);
  const maxLen = Math.min(4, words.length);
  for (let len = maxLen; len >= 1; len--) {
    const slice = words.slice(-len).join(" ");
    if (KNOWN_HEX[slice]) return KNOWN_HEX[slice]!;
  }

  const h = hash32(key) % 360;
  const s = 52 + (hash32(`s${key}`) % 20);
  const l = 44 + (hash32(`l${key}`) % 12);
  return hslToHex(h, s, l);
}

export type WarehouseProductColorRow = {
  /** Display label (one spelling kept per case-insensitive group). */
  name: string;
  /** Suggested map / legend fill (`#rrggbb`). */
  hex: string;
  /** How many catalog variants use this colour (case-insensitive merge). */
  skuCount: number;
};

const MAX_CATALOG_VARIANTS = 100_000;
const LOG_PREFIX = "[product-colors]" as const;

/**
 * Walks all rows in `shopify_product_catalog` (one per variant), reads the
 * **Colour/Color/…** option from each product (not `option1`, which is often
 * size), then returns distinct colour strings with variant counts.
 */
export async function listDistinctVariantColorsFromProductCatalog(
  db: Db,
): Promise<WarehouseProductColorRow[]> {
  const col = db.collection<ProductCatalogEntry>(
    SHOPIFY_PRODUCT_CATALOG_COLLECTION,
  );
  const totalInCollection = await col.estimatedDocumentCount();
  const cursor = col
    .find(
      {},
      { projection: { _id: 0, shopifyProduct: 1, shopifyVariant: 1 } },
    )
    .limit(MAX_CATALOG_VARIANTS);

  const byKey = new Map<
    string,
    { name: string; skuCount: number }
  >();

  let scanned = 0;
  let matchedColor = 0;
  const sampleWhenNoColor: { title: string; options: { name: string; value: string }[] }[] = [];

  for await (const row of cursor) {
    scanned += 1;
    const c = variantColorValueForWarehouse(
      row.shopifyProduct,
      row.shopifyVariant,
    );
    if (c) {
      matchedColor += 1;
    } else if (sampleWhenNoColor.length < 8) {
      const pairs = productVariantOptionsForLabel(
        row.shopifyProduct,
        row.shopifyVariant,
      );
      const title = String(row.shopifyProduct?.title ?? "—");
      sampleWhenNoColor.push({ title, options: pairs });
    }
    if (!c) continue;
    const key = c.toLowerCase();
    const prev = byKey.get(key);
    if (prev) {
      prev.skuCount += 1;
    } else {
      byKey.set(key, { name: c, skuCount: 1 });
    }
  }

  console.log(
    LOG_PREFIX,
    "catalog: estimatedDocumentCount~",
    totalInCollection,
    "scanned",
    scanned,
    "variants_with_color_option",
    matchedColor,
    "distinct_colors",
    byKey.size,
  );
  if (scanned === 0) {
    console.warn(
      LOG_PREFIX,
      "no rows in shopify_product_catalog — run a product feed sync (e.g. ensureProductCatalogSyncedForWarehouseDay or /api/warehouse/product-catalog).",
    );
  } else if (byKey.size === 0) {
    console.warn(
      LOG_PREFIX,
      "no options matched isProductOptionNameForColor — check Shopify option names (expect Color/Colour/…). Sample rows:",
    );
    for (const s of sampleWhenNoColor) {
      console.warn(LOG_PREFIX, "sample", s.title, JSON.stringify(s.options));
    }
  }

  return [...byKey.values()]
    .map(({ name, skuCount }) => ({
      name,
      hex: hexForProductColorName(name),
      skuCount,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en-GB", { sensitivity: "base" }));
}
