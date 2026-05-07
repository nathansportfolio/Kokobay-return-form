import fs from "fs";
import csv from "csv-parser";
// @ts-expect-error json2csv has no bundled types
import { Parser } from "json2csv";

import { fetchAllShopifyProducts } from "../lib/fetchAllShopifyProducts";

/**
 * 1. Load **Variant Inventory Qty** from your export CSV (handle + size / option1).
 * 2. Fetch **active** products from Shopify.
 * 3. Build the sorted list of handles that have **at least one** variant at 0 live qty.
 * 4. Take a **slice of that handle list** with `--start` / `--end` (same as `slice(start, end)`).
 * 5. Write a Shopify import CSV for live zeros where the export still has stock greater than 0.
 *
 * Run from repo root:
 *   pnpm missing-stock
 *   pnpm missing-stock -- --start 0 --end 3
 *   pnpm missing-stock -- --source ./active-products-2.csv
 *
 * Env: SHOPIFY_STORE, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET
 */

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

function isVariantRow(row: Record<string, string>): boolean {
  const o1 = row["Option1 Value"]?.trim() ?? "";
  if (!o1) return false;
  const h = row.Handle?.trim() ?? "";
  return Boolean(h);
}

function parseArgs(argv: string[]): {
  start: number;
  endExclusive: number | null;
  source: string;
} {
  let start = 0;
  let endExclusive: number | null = null;
  let source = DEFAULT_SOURCE;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--start" && argv[i + 1] != null) {
      start = Number(argv[i + 1]);
      i += 1;
    } else if (argv[i] === "--end" && argv[i + 1] != null) {
      endExclusive = Number(argv[i + 1]);
      i += 1;
    } else if (argv[i] === "--source" && argv[i + 1] != null) {
      source = argv[i + 1]!;
      i += 1;
    }
  }
  return { start, endExclusive, source };
}

async function main() {
  const { start, endExclusive, source } = parseArgs(process.argv.slice(2));

  if (!Number.isFinite(start) || start < 0 || !Number.isInteger(start)) {
    console.error("--start must be a non-negative integer.");
    process.exitCode = 1;
    return;
  }
  if (
    endExclusive != null &&
    (!Number.isFinite(endExclusive) ||
      !Number.isInteger(endExclusive) ||
      endExclusive < 0)
  ) {
    console.error("--end must be a non-negative integer (exclusive upper bound).");
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(source)) {
    console.error(`Source CSV not found: ${source}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Loading ${source}…`);
  const sourceRows = await loadCsv(source);

  const stockMap = new Map<string, number>();
  for (const row of sourceRows) {
    if (!isVariantRow(row)) continue;
    const handle = row.Handle!.trim();
    const o1 = row["Option1 Value"]!.trim();
    const qty = Number(row["Variant Inventory Qty"] ?? 0);
    stockMap.set(sizeKey(handle, o1), qty);
  }

  console.log("✅ Stock map ready\n");

  console.log("Fetching ACTIVE Shopify products…\n");
  const res = await fetchAllShopifyProducts({ status: "active" });

  if (!res.ok) {
    console.error("Failed:", res.error);
    process.exitCode = 1;
    return;
  }

  const handlesWithZero = new Set<string>();
  for (const product of res.products) {
    const hasZero = (product.variants || []).some(
      (v) => Number(v.inventory_quantity ?? 0) === 0,
    );
    if (hasZero) {
      handlesWithZero.add(product.handle);
    }
  }

  const sortedHandles = [...handlesWithZero].sort();
  const totalHandles = sortedHandles.length;
  const end =
    endExclusive == null ? totalHandles : Math.min(endExclusive, totalHandles);
  const sliceStart = Math.min(Math.max(0, start), totalHandles);

  if (sliceStart >= end) {
    console.error(
      `Empty handle range: start=${sliceStart}, end=${end} (handles with ≥1 zero variant=${totalHandles}).`,
    );
    process.exitCode = 1;
    return;
  }

  const selectedHandles = sortedHandles.slice(sliceStart, end);

  console.log("🎯 Selected Handles:");
  console.log(selectedHandles);
  console.log();

  const selectedSet = new Set(selectedHandles.map((h) => norm(h)));

  const output: Record<string, string | number | null>[] = [];

  for (const product of res.products) {
    const handle = product.handle;
    if (!selectedSet.has(norm(handle))) continue;

    const opts = [...(product.options ?? [])].sort(
      (a, b) => a.position - b.position,
    );
    const opt1Name = opts[0]?.name ?? "Size";
    const opt2Name = opts[1]?.name ?? "Color";

    for (const variant of product.variants || []) {
      const liveQty = Number(variant.inventory_quantity ?? 0);
      if (liveQty !== 0) continue;

      const o1 = variant.option1 ?? "";
      const o2 = variant.option2 ?? "";
      const correctQty = stockMap.get(sizeKey(handle, o1));

      if (correctQty === undefined || correctQty <= 0) continue;

      output.push({
        Handle: handle,
        Title: product.title,
        "Option1 Name": opt1Name,
        "Option1 Value": o1,
        "Option2 Name": opt2Name,
        "Option2 Value": o2,
        "Variant SKU": variant.sku,
        "Variant Inventory Qty": correctQty,
        "Variant Inventory Tracker": "shopify",
        "Variant Inventory Policy": "deny",
        "Variant Fulfillment Service": "manual",
      });
    }
  }

  if (!output.length) {
    console.log("⚠️ Nothing to write (no live zeros with export qty > 0 for this batch).");
    console.log("✅ DONE");
    console.log(`📦 Products in batch: ${selectedHandles.length}`);
    console.log(`📄 Rows: 0`);
    return;
  }

  const parser = new Parser({
    fields: [
      "Handle",
      "Title",
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

  const fileName = `stock-fix-${sliceStart}-${end}-${selectedHandles.length}p.csv`;
  fs.writeFileSync(fileName, parser.parse(output), "utf8");

  console.log("✅ DONE");
  console.log(`📦 Products in file: ${selectedHandles.length}`);
  console.log(`📄 Rows: ${output.length}`);
  console.log(`📁 File: ${fileName}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
