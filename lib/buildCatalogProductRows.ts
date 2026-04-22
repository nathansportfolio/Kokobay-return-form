import type { CatalogProductRow } from "@/types/catalogProduct";
import type { ShopifyProduct, ShopifyVariant } from "@/types/shopify";
import { kokobayLocationTitle, parseKokobayLocation, randomKokobayLocationForIndex } from "@/lib/kokobayLocationFormat";
import type { WarehouseProduct } from "@/lib/warehouseMockProducts";

type MongoRow = Pick<
  WarehouseProduct,
  | "sku"
  | "name"
  | "location"
  | "unitPricePence"
  | "quantityAvailable"
  | "color"
  | "category"
  | "thumbnailImageUrl"
>;
type MongoBySku = Map<string, MongoRow>;

function variantImageUrl(
  p: ShopifyProduct,
  v: ShopifyVariant,
): string {
  if (v.image_id) {
    const im = p.images.find((i) => i.id === v.image_id);
    if (im) return im.src;
  }
  if (p.image) return p.image.src;
  return p.images[0]?.src ?? "";
}

function defaultPriceGbp(
  v: ShopifyVariant,
  m: MongoRow | undefined,
): number {
  const fromShopify = Number(String(v.price ?? "0") || 0);
  if (fromShopify > 0) return fromShopify;
  if (m?.unitPricePence != null) {
    return Math.max(0, m.unitPricePence) / 100;
  }
  return 0;
}

function pickStock(
  v: ShopifyVariant,
  m: MongoRow | undefined,
): { n: number; fromDb: boolean } {
  if (m && typeof m.quantityAvailable === "number" && m.quantityAvailable >= 0) {
    return { n: m.quantityAvailable, fromDb: true };
  }
  const n = Math.max(0, v.inventory_quantity ?? 0);
  return { n, fromDb: false };
}

function pickLocation(
  p: ShopifyProduct,
  v: ShopifyVariant,
  m: MongoRow | undefined,
): { line: string; fromDb: boolean; bin: string; locationLine: string } {
  const raw = m?.location?.trim() ?? "";
  if (raw) {
    const parsed = parseKokobayLocation(raw);
    if (parsed) {
      return {
        line: raw,
        fromDb: true,
        bin: String(parsed.bin),
        locationLine: kokobayLocationTitle(raw),
      };
    }
  }
  const i = p.id * 1_000_000 + (v.id % 1_000_000);
  const gen = randomKokobayLocationForIndex(
    (i < 0 ? 0 : i) % 10_000_000,
  );
  const p2 = parseKokobayLocation(gen);
  return {
    line: gen,
    fromDb: false,
    bin: p2 ? String(p2.bin) : "—",
    locationLine: kokobayLocationTitle(gen),
  };
}

/**
 * Flattens Shopify products to variant rows, overlaying DB when SKU matches
 * and warehouse fields are valid. Missing/invalid `location` uses a
 * deterministic placeholder code (same style as mock seed).
 */
export function buildCatalogProductRows(
  products: ShopifyProduct[],
  bySku: MongoBySku,
): CatalogProductRow[] {
  const rows: CatalogProductRow[] = [];
  for (const p of products) {
    for (const v of p.variants) {
      const sku = (v.sku && String(v.sku).trim()) || "";
      const displaySku = sku || `— (${v.id})`;
      const m = sku ? bySku.get(sku) : undefined;
      const { line, fromDb, bin, locationLine } = pickLocation(p, v, m);
      const { n: stock, fromDb: stockFromDb } = pickStock(v, m);
      const img = variantImageUrl(p, v);
      const color =
        m?.color && String(m.color).trim()
          ? String(m.color).trim()
          : "—";
      const category =
        (p.product_type && p.product_type.trim()) ||
        (m?.category && String(m.category).trim()) ||
        "—";
      const priceGbp = defaultPriceGbp(v, m);
      const variantTitle =
        (v.title && v.title !== "Default Title" && v.title.trim()
          ? v.title
          : p.title) || p.title;

      rows.push({
        key: `sp-${p.id}-sv-${v.id}`,
        shopifyProductId: p.id,
        shopifyVariantId: v.id,
        sku: displaySku,
        productTitle: p.title,
        variantTitle,
        imageUrl: img,
        priceGbp,
        location: line,
        locationLine: locationLine || line,
        bin,
        stock,
        category,
        color,
        locationFromDb: fromDb,
        stockFromDb: stockFromDb,
        hadMongoMatch: Boolean(m),
      });
    }
  }
  return rows;
}
