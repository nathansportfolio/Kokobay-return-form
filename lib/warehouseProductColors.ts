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
 *
 * Catalogue colour names below were merged from repo CSV exports that carry
 * Shopify **Color** option values / colour metafields (e.g.
 * `shopify-metafields-output.csv`, `active-products-*.csv`, `fixed-products.csv`,
 * `my-import.csv`). Hex values are a first pass — refine with brand swatches.
 */
const KNOWN_HEX: Readonly<Record<string, string>> = {
  amber: "#c89b4b",
  apricot: "#f2c6a8",
  assorted: "#7a7a7a",

  beige: "#d8c7aa",
  black: "#1c1c1c",

  "black & white": "#4b4b4b",
  "black & white crochet": "#474747",
  "black & white floral": "#4a4a4a",
  "black floral": "#222222",
  "black lace": "#2a2a2a",
  "black velvet": "#161616",
  "black white": "#4b4b4b",
  "black white crochet": "#474747",
  "black white floral": "#4a4a4a",

  blue: "#5c7fa3",
  "blue & purple floral": "#7c6b9d",
  "blue floral": "#7292b3",
  "blue paisley": "#5a7696",
  "blueberry cream": "#b8bfd8",

  blush: "#e5c3c8",

  brown: "#7b5b45",
  "brown snake print": "#846348",

  burgundy: "#6f3438",

  camel: "#c2a078",

  charcoal: "#454545",

  "cherry blush": "#d79aa4",
  "cherry swirl": "#b94c54",

  chocolate: "#5e4333",

  clear: "#dfe9ef",

  coral: "#d99074",

  cream: "#f4ead8",

  crimson: "#9d4444",

  crochet: "#b8b1a8",

  "dark taupe": "#5e5651",

  denim: "#61758f",

  dot: "#9a9a9a",

  eden: "#56765c",
  "eden print": "#4d6752",

  floral: "#b69ac9",

  gold: "#b08b47",

  gray: "#9b9b9b",
  green: "#628268",

  "green leopard": "#6b7c58",

  grey: "#9b9b9b",
  "grey knit": "#a6a6a6",

  indigo: "#5c6289",

  ivory: "#f5f0e6",

  khaki: "#b7a47c",

  knit: "#a8a29e",

  lace: "#ddd8d2",

  lemon: "#e7d86d",
  "lemon floral": "#e4d06b",
  "lemon sorbet": "#f3e7a5",

  leopard: "#8b6a43",

  "light blue": "#a7c0d8",

  lime: "#98ab68",

  maroon: "#5b3134",

  mauve: "#9d7b84",

  melt: "#8b684d",

  "milkshake pink": "#efd3dc",

  mocha: "#7a5a49",

  "mocha melt": "#6f5240",

  multi: "#7c7c7c",
  "multi colour": "#7c7c7c",
  multicolor: "#7c7c7c",
  multicolour: "#7c7c7c",

  natural: "#d7c7af",

  navy: "#32465a",
  "navy blue": "#32465a",

  oatmeal: "#d8c7b0",

  "off white": "#ede7dc",
  offwhite: "#ede7dc",

  olive: "#737a55",

  orange: "#cf8b5e",

  paisley: "#767fb3",
  "paisley floral": "#8f95bf",

  pearl: "#f1efea",

  pink: "#d8a6b6",
  "pink floral": "#dcaabb",
  "pink leopard": "#c16a84",

  plum: "#65415d",

  "polka dot": "#7e8790",

  "powder blue": "#bfd1df",
  "powder pink": "#e8c6d2",

  print: "#8a8a8a",

  purple: "#7d6b91",

  red: "#bb5555",

  rio: "#c87b4d",

  rose: "#cf8c95",
  "rose leopard": "#c97b88",

  sage: "#8d9b7d",

  silver: "#c9c9c9",

  sorbet: "#e8a7aa",

  stone: "#8a8178",

  "strawberry sorbet": "#d96d78",

  swirl: "#9a8bb8",

  tan: "#c5a27e",

  taupe: "#8d817d",

  teal: "#5f8783",

  turquoise: "#72a79f",

  velvet: "#5f496f",

  violet: "#8a76a6",

  white: "#f8f8f6",

  "white floral": "#f5f3ef",

  wine: "#6a3d44",

  yellow: "#d5b65c",

  "yellow & brown floral": "#b89257",
  "yellow floral": "#d1b15a",
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

  const HUES = [15, 28, 42, 65, 88, 140, 190, 220, 255, 320];

  const h = HUES[hash32(key) % HUES.length];
  const s = 28 + (hash32(`s${key}`) % 18);
  const l = 56 + (hash32(`l${key}`) % 8);
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
