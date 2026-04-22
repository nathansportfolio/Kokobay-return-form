import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import type { KokobayOrderLine } from "@/lib/kokobayOrderLines";

const TARGET_LINES = 2;
/** Sample enough random docs to almost always get two unique SKUs in one go. */
const SAMPLE_POOL = 40;

type ProductRow = {
  sku?: string;
  name?: string;
  unitPricePence?: number;
  thumbnailImageUrl?: string;
};

/**
 * Picks up to two random **distinct** products from MongoDB `products` (same
 * data as picking / mock seed). Thumbnails use `thumbnailImageUrl`.
 */
export async function getReturnOrderLinesFromProducts(
  orderRef: string,
): Promise<KokobayOrderLine[]> {
  const key = orderRef.trim();
  if (!key) return [];

  const client = await clientPromise;
  const col = client.db(kokobayDbName).collection("products");
  const n = await col.countDocuments({ sku: { $exists: true, $ne: null } });
  if (n === 0) return [];

  const need = n >= TARGET_LINES ? TARGET_LINES : 1;
  const sampleSize = Math.min(SAMPLE_POOL, n);

  const raw = await col
    .aggregate<ProductRow>([
      {
        $match: {
          sku: { $exists: true, $ne: null, $nin: [""] },
        },
      },
      { $sample: { size: sampleSize } },
    ])
    .toArray();

  const upper = key.toUpperCase();
  const lines: KokobayOrderLine[] = [];
  const used = new Set<string>();

  for (const doc of raw) {
    if (lines.length >= need) break;
    const sku = String(doc.sku ?? "").trim();
    if (!sku || used.has(sku)) continue;
    used.add(sku);
    const pence = Math.max(0, Math.round(Number(doc.unitPricePence) || 0));
    const thumb = doc.thumbnailImageUrl
      ? String(doc.thumbnailImageUrl).trim()
      : "";
    lines.push({
      id: `${upper}-line-${lines.length}-${sku}`,
      sku,
      title: String(doc.name ?? "").trim() || sku,
      quantity: 1,
      unitPrice: pence / 100,
      imageUrl: thumb,
    });
  }

  return lines;
}

/**
 * Thumbnail URL per SKU from `products` (empty string if missing).
 */
export async function getThumbnailsBySkus(
  skus: string[],
): Promise<Map<string, string>> {
  const uniq = [...new Set(skus.map((s) => String(s).trim()).filter(Boolean))];
  const m = new Map<string, string>();
  if (uniq.length === 0) return m;

  const client = await clientPromise;
  const col = client.db(kokobayDbName).collection("products");
  const docs = await col
    .find(
      { sku: { $in: uniq } },
      { projection: { sku: 1, thumbnailImageUrl: 1 } },
    )
    .toArray();
  for (const d of docs) {
    const sku = String((d as { sku?: string }).sku ?? "").trim();
    const url = (d as { thumbnailImageUrl?: string }).thumbnailImageUrl;
    if (sku) m.set(sku, url ? String(url).trim() : "");
  }
  for (const s of uniq) {
    if (!m.has(s)) m.set(s, "");
  }
  return m;
}
