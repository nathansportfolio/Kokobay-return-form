import fs from "fs";
import csv from "csv-parser";

export type VariantStockRow = {
  size: string;
  stock: number;
  /** `Option2 Value` when the export has a second option (often colour). */
  colour: string;
  variantSku: string;
};

function norm(v: string): string {
  return v.trim().toLowerCase();
}

function qtyFromRow(row: Record<string, string>): number {
  const raw =
    row["Variant Inventory Qty"] ??
    row["variant inventory qty"] ??
    row.inventory_quantity ??
    "0";
  const n = Number(String(raw).trim());
  return Number.isFinite(n) ? n : 0;
}

function isVariantRow(row: Record<string, string>): boolean {
  const o1 = row["Option1 Value"]?.trim() ?? "";
  if (!o1) return false;
  const h = row.Handle?.trim() ?? "";
  return Boolean(h);
}

function loadCsv(file: string): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    fs.createReadStream(file)
      .pipe(csv())
      .on("data", (row: Record<string, string>) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

/**
 * Reads a Shopify-style CSV with variant columns (e.g. `shopify-stock-live.csv` from
 * `shopify-stock-export`, or a full export like `active-products-2.csv`) and
 * returns **deduped** variant lines for a single handle: size (`Option1 Value`),
 * stock (`Variant Inventory Qty`), plus colour and SKU when present.
 *
 * Rows without `Option1 Value` (image-only lines, etc.) are ignored.
 * Duplicate variant rows (same size + colour + SKU) keep the **first** occurrence
 * in file order (same convention as `list-inventory-for-handles --dedupe`).
 */
export async function getVariantStockByHandleFromExportCsv(
  csvPath: string,
  handle: string,
): Promise<VariantStockRow[]> {
  const want = handle.trim();
  if (!want) return [];

  const rows = await loadCsv(csvPath);
  const seen = new Set<string>();
  const out: VariantStockRow[] = [];

  for (const row of rows) {
    if (!isVariantRow(row)) continue;
    const h = row.Handle!.trim();
    if (h !== want) continue;

    const size = row["Option1 Value"]!.trim();
    const colour = (row["Option2 Value"] ?? "").trim();
    const variantSku = (row["Variant SKU"] ?? "").trim();
    const key = `${norm(size)}|||${norm(colour)}|||${norm(variantSku)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      size,
      stock: qtyFromRow(row),
      colour,
      variantSku,
    });
  }

  return out;
}
