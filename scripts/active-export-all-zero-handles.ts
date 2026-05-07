import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csv-parser";

/**
 * Reads a Shopify-style export CSV and **console.log**s each **Handle** where
 * **every** variant row (non-empty `Option1 Value`) has `Variant Inventory Qty` === 0.
 *
 * Default file: `active-products-99.csv` in the repo root.
 *
 * Run from repo root:
 *   pnpm active-export-all-zero-handles
 *   pnpm active-export-all-zero-handles -- --source ./active-products-2.csv
 *   pnpm active-export-all-zero-handles -- --count-only   # only the total line
 */

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const DEFAULT_SOURCE = path.join(REPO_ROOT, "active-products-99.csv");

function resolvePath(p: string): string {
  if (path.isAbsolute(p)) {
    return path.join(REPO_ROOT, path.basename(p));
  }
  return path.resolve(REPO_ROOT, p);
}

function parseArgs(argv: string[]): { source: string; countOnly: boolean } {
  let source = DEFAULT_SOURCE;
  let countOnly = false;
  const filtered = argv.filter((a) => a !== "--");
  for (let i = 0; i < filtered.length; i += 1) {
    if (filtered[i] === "--source" && filtered[i + 1]) {
      source = filtered[i + 1]!;
      i += 1;
    } else if (filtered[i] === "--count-only") {
      countOnly = true;
    }
  }
  return { source: resolvePath(source), countOnly };
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

async function main() {
  const { source, countOnly } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(source)) {
    console.error(`File not found: ${source}`);
    process.exitCode = 1;
    return;
  }

  const rows = await loadCsv(source);

  const byHandle = new Map<string, number[]>();

  for (const row of rows) {
    if (!isVariantRow(row)) continue;
    const handle = row.Handle!.trim();
    const qty = qtyFromRow(row);
    const list = byHandle.get(handle) ?? [];
    list.push(qty);
    byHandle.set(handle, list);
  }

  const allZero: string[] = [];

  for (const [handle, qtys] of [...byHandle.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (qtys.length === 0) continue;
    if (!qtys.every((q) => q === 0)) continue;
    allZero.push(handle);
    if (!countOnly) console.log(handle);
  }

  const label = path.basename(source);
  if (countOnly) {
    console.log(
      `${label}: handles where every variant row has qty 0: ${allZero.length}`,
    );
  } else {
    console.log(`\nHandles where every variant row has qty 0: ${allZero.length}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
