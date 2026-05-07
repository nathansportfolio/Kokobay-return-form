import fs from "fs";
import csv from "csv-parser";
// @ts-expect-error json2csv has no bundled types
import { Parser } from "json2csv";

import { fetchAllShopifyProducts } from "../lib/fetchAllShopifyProducts";

/**
 * For handles listed in `zero-stock-handles.csv` (from `pnpm missing-stock`),
 * load **Variant Inventory Qty** from `active-products-2.csv`, compare to live
 * Admin REST inventory, and write a small Shopify CSV that sets qty where live
 * is 0 but the export still has stock. Matching is **handle + size (option1) only**;
 * colour (option2) is ignored when reading the export (if several CSV rows share
 * the same handle+size, the last row wins). Output rows still include live
 * option2 so Shopify can match the variant.
 *
 * Run from repo root:
 *   pnpm fix-zero-stock-from-export
 *
 * Optional args:
 *   --handles ./zero-stock-handles.csv
 *   --source ./active-products-2.csv
 *
 * Env: SHOPIFY_STORE, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET
 */

const DEFAULT_HANDLES = "./zero-stock-handles.csv";
const DEFAULT_SOURCE = "./active-products-2.csv";

function norm(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function sizeKey(handle: string, size: string): string {
  return `${norm(handle)}|||${norm(size)}`;
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

function parseArgs(argv: string[]): { handles: string; source: string } {
  let handles = DEFAULT_HANDLES;
  let source = DEFAULT_SOURCE;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--handles" && argv[i + 1]) {
      handles = argv[i + 1]!;
      i += 1;
    } else if (argv[i] === "--source" && argv[i + 1]) {
      source = argv[i + 1]!;
      i += 1;
    }
  }
  return { handles, source };
}

function loadHandleFilter(path: string): Set<string> {
  const raw = fs.readFileSync(path, "utf8");
  const lines = raw.split(/\r?\n/).map((l) => l.trim());
  const set = new Set<string>();
  for (const line of lines) {
    if (!line || /^handle$/i.test(line)) continue;
    set.add(norm(line));
  }
  return set;
}

function isVariantRow(row: Record<string, string>): boolean {
  const o1 = row["Option1 Value"]?.trim() ?? "";
  if (!o1) return false;
  const h = row.Handle?.trim() ?? "";
  return Boolean(h);
}

async function main() {
  const { handles: handlesPath, source: sourcePath } = parseArgs(
    process.argv.slice(2),
  );

  if (!fs.existsSync(handlesPath)) {
    console.error(`Missing handles file: ${handlesPath}`);
    console.error("Run `pnpm missing-stock` first, or pass --handles <path>.");
    process.exitCode = 1;
    return;
  }
  if (!fs.existsSync(sourcePath)) {
    console.error(`Missing source CSV: ${sourcePath}`);
    process.exitCode = 1;
    return;
  }

  const handleFilter = loadHandleFilter(handlesPath);
  console.log(`Target handles: ${handleFilter.size} (from ${handlesPath})\n`);

  console.log(`Loading export ${sourcePath}…`);
  const sourceRows = await loadCsv(sourcePath);

  /** Correct qty from latest export, keyed by handle + size (option1) only */
  const exportQty = new Map<string, number>();

  for (const row of sourceRows) {
    if (!isVariantRow(row)) continue;
    const handle = row.Handle!.trim();
    if (!handleFilter.has(norm(handle))) continue;

    const o1 = row["Option1 Value"]!.trim();
    const qty = Number(row["Variant Inventory Qty"] ?? 0);
    exportQty.set(sizeKey(handle, o1), qty);
  }

  console.log(`Export handle+size keys for those handles: ${exportQty.size}\n`);

  console.log("Fetching ACTIVE Shopify products…");
  const res = await fetchAllShopifyProducts({ status: "active" });
  if (!res.ok) {
    console.error("Failed:", res.error);
    process.exitCode = 1;
    return;
  }

  const option1NameByHandle = new Map<string, string>();
  const option2NameByHandle = new Map<string, string>();

  const output: Record<string, string | number | null>[] = [];
  let liveZero = 0;
  let fixed = 0;
  let noExportRow = 0;
  let exportZero = 0;

  for (const product of res.products) {
    const handle = product.handle;
    if (!handleFilter.has(norm(handle))) continue;

    const opts = [...(product.options ?? [])].sort(
      (a, b) => a.position - b.position,
    );
    option1NameByHandle.set(handle, opts[0]?.name ?? "Size");
    option2NameByHandle.set(handle, opts[1]?.name ?? "Color");

    for (const variant of product.variants || []) {
      const liveQty = Number(variant.inventory_quantity ?? 0);
      if (liveQty !== 0) continue;

      liveZero += 1;

      const o1 = variant.option1 ?? "";
      const o2 = variant.option2 ?? "";
      const correctQty = exportQty.get(sizeKey(handle, o1));

      if (correctQty === undefined) {
        noExportRow += 1;
        console.log(`no CSV qty for handle+size: ${handle} | ${o1}`);
        continue;
      }
      if (correctQty <= 0) {
        exportZero += 1;
        continue;
      }

      output.push({
        Handle: handle,
        "Option1 Name": option1NameByHandle.get(handle) ?? "Size",
        "Option1 Value": o1,
        "Option2 Name": option2NameByHandle.get(handle) ?? "Color",
        "Option2 Value": o2,
        "Variant SKU": variant.sku,
        "Variant Inventory Qty": correctQty,
        "Variant Inventory Tracker": "shopify",
        "Variant Inventory Policy": "deny",
        "Variant Fulfillment Service": "manual",
      });
      fixed += 1;
    }
  }

  console.log("\n---");
  console.log(`Live variants (filtered handles) at 0 qty: ${liveZero}`);
  console.log(`Rows written (0 live → export qty > 0): ${fixed}`);
  console.log(`Skipped (no matching handle+size in export): ${noExportRow}`);
  console.log(`Skipped (export also 0): ${exportZero}`);

  if (!output.length) {
    console.log("\nNothing to write.");
    return;
  }

  const parser = new Parser({
    fields: [
      "Handle",
      "Option1 Name",
      "Option1 Value",
      "Option2 Name",
      "Option2 Value",
      "Variant SKU",
      "Variant Inventory Qty",
      "Variant Inventory Tracker",
      "Variant Inventory Policy",
      "Variant Fulfillment Service",
    ],
  });

  const outName = `stock-fix-from-export-${fixed}-rows.csv`;
  fs.writeFileSync(outName, parser.parse(output), "utf8");
  console.log(`\nWrote ${outName}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
