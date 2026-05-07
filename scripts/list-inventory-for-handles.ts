import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csv-parser";

/**
 * Prints **Handle**, **Size** (`Option1 Value`), **Variant Inventory Qty** for every
 * variant row in a Shopify export CSV whose handle appears in `--handles-file`
 * (one handle per line, `#` comments and blank lines ignored).
 *
 *   pnpm list-inventory-for-handles
 *   pnpm list-inventory-for-handles -- --dedupe
 *   pnpm list-inventory-for-handles -- --source ./active-products-2.csv --handles-file ./my-handles.txt
 *
 * Default CSV is `shopify-stock-live.csv` (run `pnpm shopify-stock-export` first).
 */

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const DEFAULT_SOURCE = path.join(REPO_ROOT, "shopify-stock-live.csv");
const DEFAULT_HANDLES_FILE = path.join(
  REPO_ROOT,
  "scripts",
  "handles-inventory-query.txt",
);

function resolvePath(p: string): string {
  if (path.isAbsolute(p)) return p;
  return path.resolve(REPO_ROOT, p);
}

function parseArgs(argv: string[]): {
  source: string;
  handlesFile: string;
  dedupe: boolean;
} {
  let source = DEFAULT_SOURCE;
  let handlesFile = DEFAULT_HANDLES_FILE;
  let dedupe = false;
  const filtered = argv.filter((a) => a !== "--");
  for (let i = 0; i < filtered.length; i += 1) {
    if (filtered[i] === "--source" && filtered[i + 1]) {
      source = resolvePath(filtered[i + 1]!);
      i += 1;
    } else if (filtered[i] === "--handles-file" && filtered[i + 1]) {
      handlesFile = resolvePath(filtered[i + 1]!);
      i += 1;
    } else if (filtered[i] === "--dedupe") {
      dedupe = true;
    }
  }
  return { source, handlesFile, dedupe };
}

function loadHandlesFile(file: string): Set<string> {
  const raw = fs.readFileSync(file, "utf8");
  const set = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const h = line.trim();
    if (!h || h.startsWith("#")) continue;
    set.add(h);
  }
  return set;
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
  const { source, handlesFile, dedupe } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(source)) {
    console.error(`Source CSV not found: ${source}`);
    process.exitCode = 1;
    return;
  }
  if (!fs.existsSync(handlesFile)) {
    console.error(`Handles file not found: ${handlesFile}`);
    process.exitCode = 1;
    return;
  }

  const handleSet = loadHandlesFile(handlesFile);
  const rows = await loadCsv(source);
  let n = 0;
  const seen = new Set<string>();

  for (const row of rows) {
    if (!isVariantRow(row)) continue;
    const handle = row.Handle!.trim();
    if (!handleSet.has(handle)) continue;
    const size = row["Option1 Value"]!.trim();
    const qty = qtyFromRow(row);
    const line = `${handle}\t${size}\t${qty}`;
    if (dedupe) {
      const o2 = (row["Option2 Value"] ?? "").trim();
      const sku = (row["Variant SKU"] ?? "").trim();
      const key = `${handle}\t${size}\t${o2}\t${sku}\t${qty}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    console.log(line);
    n += 1;
  }

  console.error(
    `\nPrinted ${n} variant rows${dedupe ? " (deduped by handle+size+colour+SKU+qty)" : ""} (${handleSet.size} handles listed in ${path.basename(handlesFile)}).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
