import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csv-parser";
// @ts-expect-error json2csv has no bundled types
import { Parser } from "json2csv";

/**
 * Compares the **live stock CSV** (e.g. `shopify-stock-export`) with
 * **`active-products-2.csv`** and writes a Shopify-style CSV that restores
 * **Variant Inventory Qty** from the active export.
 *
 * **Only includes Shopify `active` products** (when `Status` is present on the
 * stock CSV) where **every** real variant on the stock file for that handle
 * has **qty 0**, and **every published** variant row in the active export for
 * that handle exists on the stock file with qty 0 (so we do not treat a
 * product as “all zero” if the live export is missing sizes or still has stock).
 *
 * Then emits restore rows from the active export where **qty > 0** on backup.
 *
 * Columns: Handle, Title, size/colour option names & values, SKU, new qty,
 * plus tracker/policy/service for import.
 *
 * Run from repo root:
 *   pnpm stock-restore-csv
 *   pnpm stock-restore-csv -- --source ./shopify-stock-latest.csv --active-csv ./active-products-2.csv --out stock-restore.csv
 *
 * One-shot refresh (active Shopify stock → `stock-zero-fix.csv`):
 *   pnpm repopulate-stock-zero-fix
 */

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const DEFAULT_STOCK = path.join(REPO_ROOT, "shopify-stock-live.csv");
const DEFAULT_ACTIVE = path.join(REPO_ROOT, "active-products-2.csv");
const DEFAULT_OUT = path.join(REPO_ROOT, "stock-zero-restore-from-active.csv");

function norm(v: string): string {
  return v.trim().toLowerCase();
}

function variantKey(handle: string, o1: string, o2: string): string {
  return `${norm(handle)}|||${norm(o1)}|||${norm(o2)}`;
}

function resolvePath(p: string): string {
  if (path.isAbsolute(p)) {
    return path.join(REPO_ROOT, path.basename(p));
  }
  return path.resolve(REPO_ROOT, p);
}

function parseArgs(argv: string[]): {
  stockCsv: string;
  activeCsv: string;
  out: string;
} {
  let stockCsv = DEFAULT_STOCK;
  let activeCsv = DEFAULT_ACTIVE;
  let out = DEFAULT_OUT;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--source" && argv[i + 1]) {
      stockCsv = argv[i + 1]!;
      i += 1;
    } else if (argv[i] === "--active-csv" && argv[i + 1]) {
      activeCsv = argv[i + 1]!;
      i += 1;
    } else if (argv[i] === "--out" && argv[i + 1]) {
      out = argv[i + 1]!;
      i += 1;
    }
  }
  return {
    stockCsv: resolvePath(stockCsv),
    activeCsv: resolvePath(activeCsv),
    out: resolvePath(out),
  };
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

/** Stock CSV: real variant row for an **active** Shopify product (`Status` = active, or column absent). */
function isActiveShopifyStockRow(row: Record<string, string>): boolean {
  if (!isVariantRow(row)) return false;
  const st = (row.Status ?? "").trim();
  if (!st) return true;
  return st.toLowerCase() === "active";
}

/** Active export: storefront variant row (`Published` = TRUE; column absent = include). */
function isPublishedActiveVariantRow(row: Record<string, string>): boolean {
  if (!isVariantRow(row)) return false;
  const p = (row.Published ?? "").trim();
  if (!p) return true;
  const u = p.toUpperCase();
  return u === "TRUE" || u === "YES" || u === "1";
}

type StockRow = {
  qty: number;
  sku: string | null;
  option1Name: string;
  option2Name: string;
  title: string;
};

type ActiveRow = {
  handle: string;
  title: string;
  size: string;
  color: string;
  sku: string | null;
  qty: number;
  option1Name: string;
  option2Name: string;
};

type OutRow = {
  Handle: string;
  Title: string;
  "Option1 Name": string;
  "Option1 Value": string;
  "Option2 Name": string;
  "Option2 Value": string;
  "Variant SKU": string | null;
  "Variant Inventory Qty": number;
  "Variant Inventory Tracker": string;
  "Variant Inventory Policy": string;
  "Variant Fulfillment Service": string;
};

async function main() {
  const { stockCsv, activeCsv, out } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(stockCsv)) {
    console.error(`Stock CSV not found: ${stockCsv}`);
    process.exitCode = 1;
    return;
  }
  if (!fs.existsSync(activeCsv)) {
    console.error(`Active export CSV not found: ${activeCsv}`);
    process.exitCode = 1;
    return;
  }

  const stockRows = await loadCsv(stockCsv);
  const stockByKey = new Map<string, StockRow>();
  /** Real variant keys per handle (excludes image rows with no Option1 Value). */
  const stockKeysByHandle = new Map<string, Set<string>>();

  for (const row of stockRows) {
    const handle = (row.Handle ?? "").trim();
    if (!handle || !isActiveShopifyStockRow(row)) continue;
    const o1 = row["Option1 Value"]!.trim();
    const o2 = (row["Option2 Value"] ?? "").trim();
    const k = variantKey(handle, o1, o2);
    stockByKey.set(k, {
      qty: qtyFromRow(row),
      sku: row["Variant SKU"]?.trim() || null,
      option1Name: (row["Option1 Name"] ?? "").trim() || "Size",
      option2Name: (row["Option2 Name"] ?? "").trim() || "Color",
      title: (row.Title ?? "").trim(),
    });
    let keySet = stockKeysByHandle.get(handle);
    if (!keySet) {
      keySet = new Set();
      stockKeysByHandle.set(handle, keySet);
    }
    keySet.add(k);
  }

  const activeRows = await loadCsv(activeCsv);

  /** Published variant keys per handle (backup catalog). */
  const activeKeysByHandle = new Map<string, Set<string>>();
  for (const row of activeRows) {
    if (!isPublishedActiveVariantRow(row)) continue;
    const handle = row.Handle!.trim();
    const o1 = row["Option1 Value"]!.trim();
    const o2 = (row["Option2 Value"] ?? "").trim();
    const k = variantKey(handle, o1, o2);
    let ak = activeKeysByHandle.get(handle);
    if (!ak) {
      ak = new Set();
      activeKeysByHandle.set(handle, ak);
    }
    ak.add(k);
  }

  const allZeroHandles = new Set<string>();
  for (const [handle, stockKeys] of stockKeysByHandle) {
    if (stockKeys.size === 0) continue;

    const activeKeys = activeKeysByHandle.get(handle);
    if (!activeKeys || activeKeys.size === 0) continue;

    let ok = true;
    for (const k of activeKeys) {
      if (!stockKeys.has(k)) {
        ok = false;
        break;
      }
      if ((stockByKey.get(k)?.qty ?? 0) > 0) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    for (const k of stockKeys) {
      if ((stockByKey.get(k)?.qty ?? 0) > 0) {
        ok = false;
        break;
      }
    }
    if (ok) {
      allZeroHandles.add(handle);
    }
  }

  /** Variant rows often repeat Title only on the first row — keep any non-empty title per handle. */
  const titleByHandle = new Map<string, string>();
  for (const row of activeRows) {
    const h = (row.Handle ?? "").trim();
    const t = (row.Title ?? "").trim();
    if (!h || !t) continue;
    if (!titleByHandle.has(h)) titleByHandle.set(h, t);
  }

  const activeByKey = new Map<string, ActiveRow>();

  for (const row of activeRows) {
    if (!isPublishedActiveVariantRow(row)) continue;
    const handle = row.Handle!.trim();
    const o1 = row["Option1 Value"]!.trim();
    const o2 = (row["Option2 Value"] ?? "").trim();
    const k = variantKey(handle, o1, o2);
    activeByKey.set(k, {
      handle,
      title: (row.Title ?? "").trim(),
      size: o1,
      color: o2,
      sku: row["Variant SKU"]?.trim() || null,
      qty: qtyFromRow(row),
      option1Name: (row["Option1 Name"] ?? "").trim() || "Size",
      option2Name: (row["Option2 Name"] ?? "").trim() || "Color",
    });
  }

  const output: OutRow[] = [];

  for (const [k, active] of activeByKey) {
    if (!allZeroHandles.has(active.handle)) continue;
    if (active.qty <= 0) continue;

    const stock = stockByKey.get(k);
    const stockQty = stock?.qty ?? 0;
    if (stockQty > 0) continue;

    const opt1Name =
      active.option1Name || stock?.option1Name || "Size";
    const opt2Name =
      active.option2Name || stock?.option2Name || "Color";
    const title =
      active.title ||
      titleByHandle.get(active.handle) ||
      stock?.title ||
      "";
    const sku = active.sku ?? stock?.sku ?? null;

    output.push({
      Handle: active.handle,
      Title: title,
      "Option1 Name": opt1Name,
      "Option1 Value": active.size,
      "Option2 Name": opt2Name,
      "Option2 Value": active.color,
      "Variant SKU": sku,
      "Variant Inventory Qty": active.qty,
      "Variant Inventory Tracker": "shopify",
      "Variant Inventory Policy": "deny",
      "Variant Fulfillment Service": "manual",
    });
  }

  output.sort((a, b) => {
    const h = a.Handle.localeCompare(b.Handle);
    if (h !== 0) return h;
    const s = a["Option1 Value"].localeCompare(b["Option1 Value"]);
    if (s !== 0) return s;
    return a["Option2 Value"].localeCompare(b["Option2 Value"]);
  });

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

  fs.writeFileSync(out, parser.parse(output), "utf8");

  const uniqueHandlesOut = new Set(output.map((r) => r.Handle));

  console.log(`Stock CSV variant rows (active products, with size): ${stockByKey.size}`);
  console.log(
    `Handles where every live variant is 0 and matches published backup variants: ${allZeroHandles.size}`,
  );
  console.log(`Active export variant rows: ${activeByKey.size}`);
  console.log(
    `Restore variant rows (active qty > 0, handle is all-zero in stock): ${output.length}`,
  );
  console.log(`Unique handles in output CSV: ${uniqueHandlesOut.size}`);
  console.log(`Wrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
