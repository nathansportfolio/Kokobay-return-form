import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csv-parser";

/**
 * Reads a variant-level stock CSV (e.g. from `pnpm shopify-stock-export`) and
 * finds **handles** where **every** variant has `Variant Inventory Qty` === 0.
 *
 * By default also loads **`active-products-2.csv`** in the repo root and
 * **console.log**s what **Variant Inventory Qty** that export has per handle/size
 * (so you can compare “all zero” live vs backup export).
 *
 * Run from repo root:
 *   pnpm shopify-handles-all-zero
 *   pnpm shopify-handles-all-zero -- --source ./shopify-stock-latest.csv
 *   pnpm shopify-handles-all-zero -- --active-csv ./active-products-2.csv
 *   pnpm shopify-handles-all-zero -- --no-active-export
 *   pnpm shopify-handles-all-zero -- --count-only   # only summary counts
 *   pnpm shopify-handles-all-zero -- --handles-only --no-active-export
 *     # one handle per line (live stock CSV)
 *
 * At the end (when the active export is loaded), logs how many **unique**
 * handle+size+colour variants have **qty > 0** in `active-products-2.csv` but
 * **no matching row** in the stock CSV.
 */

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const DEFAULT_SOURCE = path.join(REPO_ROOT, "shopify-stock-live.csv");
const DEFAULT_ACTIVE_EXPORT = path.join(REPO_ROOT, "active-products-2.csv");

function norm(v: string): string {
  return v.trim().toLowerCase();
}

/** Same handle + option1 + option2 as one variant row in both CSVs. */
function variantKey(handle: string, o1: string, o2: string): string {
  return `${norm(handle)}|||${norm(o1)}|||${norm(o2)}`;
}

type VariantLine = {
  qty: number;
  size: string;
  color: string;
};

type ExportVariantLine = {
  size: string;
  color: string;
  qty: number;
};

function resolveInputPath(p: string): string {
  if (path.isAbsolute(p)) return p;
  return path.resolve(REPO_ROOT, p);
}

function parseArgs(argv: string[]): {
  source: string;
  activeCsv: string | null;
  countOnly: boolean;
  handlesOnly: boolean;
} {
  let source = DEFAULT_SOURCE;
  let activeCsv: string | null = DEFAULT_ACTIVE_EXPORT;
  let skipActive = false;
  let countOnly = false;
  let handlesOnly = false;

  const filtered = argv.filter((a) => a !== "--");
  for (let i = 0; i < filtered.length; i += 1) {
    if (filtered[i] === "--source" && filtered[i + 1]) {
      source = filtered[i + 1]!;
      i += 1;
    } else if (filtered[i] === "--active-csv" && filtered[i + 1]) {
      activeCsv = filtered[i + 1]!;
      i += 1;
    } else if (filtered[i] === "--no-active-export") {
      skipActive = true;
    } else if (filtered[i] === "--count-only") {
      countOnly = true;
    } else if (filtered[i] === "--handles-only") {
      handlesOnly = true;
    }
  }

  if (skipActive) {
    activeCsv = null;
  } else if (activeCsv) {
    activeCsv = resolveInputPath(activeCsv);
  }

  return {
    source: resolveInputPath(source),
    activeCsv,
    countOnly,
    handlesOnly,
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

function formatVariant(v: VariantLine): string {
  if (v.size && v.color) return `${v.size} / ${v.color}`;
  if (v.size) return v.size;
  if (v.color) return v.color;
  return "(no options)";
}

function isActiveExportVariantRow(row: Record<string, string>): boolean {
  const o1 = row["Option1 Value"]?.trim() ?? "";
  if (!o1) return false;
  const h = row.Handle?.trim() ?? "";
  return Boolean(h);
}

function formatExportLine(v: ExportVariantLine): string {
  if (v.size && v.color) return `${v.size} / ${v.color}`;
  if (v.size) return v.size;
  return v.color || "(no options)";
}

async function main() {
  const { source, activeCsv, countOnly, handlesOnly } = parseArgs(
    process.argv.slice(2),
  );

  if (!fs.existsSync(source)) {
    console.error(`File not found: ${source}`);
    console.error("Run `pnpm shopify-stock-export` first, or pass --source <csv>.");
    process.exitCode = 1;
    return;
  }

  const rows = await loadCsv(source);

  const byHandle = new Map<string, VariantLine[]>();

  for (const row of rows) {
    const handle = (row.Handle ?? row.handle ?? "").trim();
    if (!handle) continue;

    const qty = qtyFromRow(row);
    const size = (row["Option1 Value"] ?? "").trim();
    const color = (row["Option2 Value"] ?? "").trim();

    const list = byHandle.get(handle) ?? [];
    list.push({ qty, size, color });
    byHandle.set(handle, list);
  }

  const allZeroHandles: { handle: string; variants: VariantLine[] }[] = [];

  for (const [handle, variants] of [...byHandle.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (variants.length === 0) continue;
    const allZero = variants.every((v) => v.qty === 0);
    if (!allZero) continue;
    allZeroHandles.push({ handle, variants });
  }

  let exportByHandle: Map<string, ExportVariantLine[]> | null = null;
  let activeRowsCache: Record<string, string>[] | null = null;

  if (activeCsv) {
    if (!fs.existsSync(activeCsv)) {
      console.warn(`active-products export not found (skip): ${activeCsv}\n`);
    } else {
      const activeRows = await loadCsv(activeCsv);
      activeRowsCache = activeRows;
      exportByHandle = new Map();
      for (const row of activeRows) {
        if (!isActiveExportVariantRow(row)) continue;
        const handle = row.Handle!.trim();
        const size = row["Option1 Value"]!.trim();
        const color = (row["Option2 Value"] ?? "").trim();
        const qty = qtyFromRow(row);
        const list = exportByHandle.get(handle) ?? [];
        list.push({ size, color, qty });
        exportByHandle.set(handle, list);
      }
      if (!countOnly && !handlesOnly) {
        console.log(
          `Loaded active export: ${activeCsv} (${exportByHandle.size} handles with variant rows)\n`,
        );
      }
    }
  }

  const stockLabel = path.basename(source);

  if (handlesOnly) {
    for (const { handle } of allZeroHandles) {
      console.log(handle);
    }
    console.error(
      `\n${stockLabel}: handles with all variants at 0 in stock CSV: ${allZeroHandles.length}`,
    );
  } else if (!countOnly) {
    for (const { handle, variants } of allZeroHandles) {
      const parts = variants.map(formatVariant);
      const unique = [...new Set(parts)];
      console.log(
        `--- ${handle} (all variants 0 in stock CSV) — sizes: ${unique.join(", ")}`,
      );

      if (exportByHandle) {
        const fromExport = exportByHandle.get(handle);
        if (!fromExport?.length) {
          console.log(
            "  active-products-2: (no matching variant rows for this handle)\n",
          );
        } else {
          for (const v of fromExport) {
            console.log(
              `  active-products-2: ${formatExportLine(v)} → qty ${v.qty}`,
            );
          }
          console.log("");
        }
      }
    }
  }

  if (!handlesOnly) {
    console.log(
      `${stockLabel}: handles with all variants at 0 in stock CSV: ${allZeroHandles.length}`,
    );
  }

  if (activeRowsCache && !handlesOnly) {
    const shopifyVariantKeys = new Set<string>();
    for (const row of rows) {
      const handle = (row.Handle ?? row.handle ?? "").trim();
      if (!handle) continue;
      const o1 = (row["Option1 Value"] ?? "").trim();
      const o2 = (row["Option2 Value"] ?? "").trim();
      if (!o1 && !o2) continue;
      shopifyVariantKeys.add(variantKey(handle, o1, o2));
    }

    const activePositiveNotInStockCsv = new Set<string>();
    for (const row of activeRowsCache) {
      if (!isActiveExportVariantRow(row)) continue;
      if (qtyFromRow(row) <= 0) continue;
      const handle = row.Handle!.trim();
      const o1 = row["Option1 Value"]!.trim();
      const o2 = (row["Option2 Value"] ?? "").trim();
      const k = variantKey(handle, o1, o2);
      if (!shopifyVariantKeys.has(k)) {
        activePositiveNotInStockCsv.add(k);
      }
    }

    const extra = countOnly ? "" : "\n";
    console.log(
      `${extra}In active-products export (qty > 0) but no matching row in stock CSV (unique handle+size+colour): ${activePositiveNotInStockCsv.size}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
