import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csv-parser";

/**
 * Takes handles that are **all qty 0** in one export (default `active-products-99.csv`)
 * and, for each of those handles, prints every **variant row in `active-products-2.csv`**
 * that has **Variant Inventory Qty > 0**.
 *
 * Appends **Title**, **Colour**, and **Variant SKU** from the enrich CSV (default
 * `my-import.range-1-266.csv`) for the same variant: match on handle + size + colour
 * first, else handle + size.
 *
 * Tab columns: Handle, Size, Colour (from lookup), Qty (lookup), SKU (import),
 * Colour (import display), Title (import)
 *
 * Run from repo root:
 *   pnpm active2-stock-for-zero-handles
 *   pnpm active2-stock-for-zero-handles -- --out ./active2-zero-handles-stock.csv
 *   pnpm active2-stock-for-zero-handles -- --enrich-from ./active-products-99.csv
 */

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const DEFAULT_LOOKUP = path.join(REPO_ROOT, "active-products-2.csv");
const DEFAULT_FROM_ZERO = path.join(REPO_ROOT, "active-products-99.csv");
const DEFAULT_ENRICH = path.join(REPO_ROOT, "my-import.range-1-266.csv");

function norm(v: string): string {
  return v.trim().toLowerCase();
}

/** Option2 in import CSV is often short ("Melt"); handle ends with full slug ("mocha-melt"). */
function slugFromOption2(option2: string): string {
  return norm(option2).replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function titleCaseHyphenSlug(hyphenPart: string): string {
  return hyphenPart
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Option2 tail words that are usually shortened in CSV; full phrase lives on handle. */
const COLOUR_SLUGS_WITH_PREFIX = new Set([
  "melt",
  "sorbet",
  "blush",
  "floral",
  "print",
]);

function displayColourFromHandle(handle: string, option2: string): string {
  const raw = option2.trim();
  if (!raw) return raw;
  // Apparel letter sizes — do not treat as slug tail
  if (/\(/.test(raw) && /^\s*X?S|^S\s*\(|^M\s*\(|^L\s*\(|^X?L\s*\(/i.test(raw)) {
    return raw;
  }
  const slug = slugFromOption2(raw);
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return raw;

  const hl = handle.trim().toLowerCase();
  if (!hl.endsWith(`-${slug}`) && hl !== slug) return raw;

  const esc = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // (.*)- is greedy/backtracking so we do not start at the first "-"; middle group may still be "".
  const m = hl.match(new RegExp(`^(.*)-((?:[a-z0-9]+-)*)${esc}$`, "i"));
  if (!m) return raw;
  let hyphenPart = ((m[2] ?? "") + slug).replace(/-+/g, "-");
  let segments = hyphenPart.split("-").filter(Boolean);
  if (segments.length < 2 && (m[1] ?? "").length > 0) {
    const preSegs = m[1]!.toLowerCase().split("-").filter(Boolean);
    const prev = preSegs[preSegs.length - 1];
    if (prev) {
      if (COLOUR_SLUGS_WITH_PREFIX.has(slug)) {
        hyphenPart = `${prev}-${slug}`;
        segments = hyphenPart.split("-").filter(Boolean);
      } else if (
        slug === "white" &&
        ["black", "blue", "navy", "pink", "red", "lemon"].includes(prev)
      ) {
        hyphenPart = `${prev}-white`;
        segments = hyphenPart.split("-").filter(Boolean);
      }
    }
  }
  if (segments.length < 2) return titleCaseHyphenSlug(slug);
  return titleCaseHyphenSlug(hyphenPart);
}

function variantKey(handle: string, o1: string, o2: string): string {
  return `${norm(handle)}|||${norm(o1)}|||${norm(o2)}`;
}

function sizeKey(handle: string, o1: string): string {
  return `${norm(handle)}|||${norm(o1)}`;
}

function resolvePath(p: string): string {
  if (path.isAbsolute(p)) {
    return path.join(REPO_ROOT, path.basename(p));
  }
  return path.resolve(REPO_ROOT, p);
}

function resolveOutPath(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(REPO_ROOT, p);
}

function csvCell(v: string): string {
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function parseArgs(argv: string[]): {
  lookup: string;
  handlesFile: string | null;
  fromZeroExport: string | null;
  enrichFrom: string;
  out: string | null;
} {
  let lookup = DEFAULT_LOOKUP;
  let handlesFile: string | null = null;
  let fromZeroExport: string | null = DEFAULT_FROM_ZERO;
  let enrichFrom = DEFAULT_ENRICH;
  let out: string | null = null;

  const filtered = argv.filter((a) => a !== "--");
  for (let i = 0; i < filtered.length; i += 1) {
    if (filtered[i] === "--lookup" && filtered[i + 1]) {
      lookup = filtered[i + 1]!;
      i += 1;
    } else if (filtered[i] === "--handles-file" && filtered[i + 1]) {
      handlesFile = filtered[i + 1]!;
      fromZeroExport = null;
      i += 1;
    } else if (filtered[i] === "--from-zero-export" && filtered[i + 1]) {
      fromZeroExport = filtered[i + 1]!;
      handlesFile = null;
      i += 1;
    } else if (filtered[i] === "--enrich-from" && filtered[i + 1]) {
      enrichFrom = filtered[i + 1]!;
      i += 1;
    } else if (filtered[i] === "--out" && filtered[i + 1]) {
      out = filtered[i + 1]!;
      i += 1;
    }
  }

  return {
    lookup: resolvePath(lookup),
    handlesFile: handlesFile ? resolvePath(handlesFile) : null,
    fromZeroExport: fromZeroExport ? resolvePath(fromZeroExport) : null,
    enrichFrom: resolvePath(enrichFrom),
    out: out ? resolveOutPath(out) : null,
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

function allZeroHandlesFromRows(rows: Record<string, string>[]): Set<string> {
  const byHandle = new Map<string, number[]>();
  for (const row of rows) {
    if (!isVariantRow(row)) continue;
    const handle = row.Handle!.trim();
    const qty = qtyFromRow(row);
    const list = byHandle.get(handle) ?? [];
    list.push(qty);
    byHandle.set(handle, list);
  }
  const out = new Set<string>();
  for (const [handle, qtys] of byHandle) {
    if (qtys.length === 0) continue;
    if (qtys.every((q) => q === 0)) out.add(handle);
  }
  return out;
}

function loadHandlesFromFile(path: string): Set<string> {
  const raw = fs.readFileSync(path, "utf8");
  const set = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const h = line.trim();
    if (!h || /^handles where/i.test(h)) continue;
    set.add(h);
  }
  return set;
}

type RefRow = { sku: string; color: string; title: string };

function buildEnrichIndex(rows: Record<string, string>[]): {
  byTriple: Map<string, RefRow>;
  byHandleSize: Map<string, RefRow[]>;
} {
  const titleByHandle = new Map<string, string>();
  for (const row of rows) {
    const h = (row.Handle ?? "").trim();
    const t = (row.Title ?? "").trim();
    if (!h || !t) continue;
    if (!titleByHandle.has(h)) titleByHandle.set(h, t);
  }

  const byTriple = new Map<string, RefRow>();
  const byHandleSize = new Map<string, RefRow[]>();
  for (const row of rows) {
    if (!isVariantRow(row)) continue;
    const handle = row.Handle!.trim();
    const o1 = row["Option1 Value"]!.trim();
    const o2 = (row["Option2 Value"] ?? "").trim();
    const sku = (row["Variant SKU"] ?? "").trim();
    const title =
      (row.Title ?? "").trim() || titleByHandle.get(handle) || "";
    const ref: RefRow = { sku, color: o2, title };
    byTriple.set(variantKey(handle, o1, o2), ref);
    const ks = sizeKey(handle, o1);
    const list = byHandleSize.get(ks) ?? [];
    list.push(ref);
    byHandleSize.set(ks, list);
  }
  return { byTriple, byHandleSize };
}

function enrichFrom99(
  handle: string,
  size: string,
  colorFrom2: string,
  byTriple: Map<string, RefRow>,
  byHandleSize: Map<string, RefRow[]>,
): RefRow | null {
  const triple = byTriple.get(variantKey(handle, size, colorFrom2));
  if (triple) return triple;

  const list = byHandleSize.get(sizeKey(handle, size));
  if (!list?.length) return null;
  if (list.length === 1) return list[0]!;

  const sameColor = list.filter((r) => norm(r.color) === norm(colorFrom2));
  if (sameColor.length === 1) return sameColor[0]!;

  return list[0]!;
}

const CSV_HEADER = [
  "Handle",
  "Size",
  "Colour (lookup)",
  "Variant Inventory Qty",
  "Variant SKU",
  "Colour (import display)",
  "Title (import)",
] as const;

async function main() {
  const { lookup, handlesFile, fromZeroExport, enrichFrom, out } = parseArgs(
    process.argv.slice(2),
  );

  const zeroPath = fromZeroExport;
  const sameFile =
    zeroPath != null &&
    path.resolve(zeroPath) === path.resolve(enrichFrom);

  let handleSet: Set<string>;
  let enrichRows: Record<string, string>[];

  if (handlesFile) {
    if (!fs.existsSync(handlesFile)) {
      console.error(`Handles file not found: ${handlesFile}`);
      process.exitCode = 1;
      return;
    }
    if (!fs.existsSync(enrichFrom)) {
      console.error(`--enrich-from file not found: ${enrichFrom}`);
      process.exitCode = 1;
      return;
    }
    handleSet = loadHandlesFromFile(handlesFile);
    enrichRows = await loadCsv(enrichFrom);
  } else if (zeroPath) {
    if (!fs.existsSync(zeroPath)) {
      console.error(`--from-zero-export file not found: ${zeroPath}`);
      console.error(
        "Pass --handles-file <path> with one handle per line, or fix the path.",
      );
      process.exitCode = 1;
      return;
    }
    if (sameFile) {
      enrichRows = await loadCsv(zeroPath);
      handleSet = allZeroHandlesFromRows(enrichRows);
    } else {
      if (!fs.existsSync(enrichFrom)) {
        console.error(`--enrich-from file not found: ${enrichFrom}`);
        process.exitCode = 1;
        return;
      }
      handleSet = allZeroHandlesFromRows(await loadCsv(zeroPath));
      enrichRows = await loadCsv(enrichFrom);
    }
    console.log(
      `Handles (all variant qty 0 in ${path.basename(zeroPath)}): ${handleSet.size}\n`,
    );
  } else {
    console.error(
      "Provide --handles-file <path> or use default --from-zero-export (active-products-99.csv).",
    );
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(lookup)) {
    console.error(`Lookup CSV not found: ${lookup}`);
    process.exitCode = 1;
    return;
  }

  const { byTriple, byHandleSize } = buildEnrichIndex(enrichRows);

  const rows = await loadCsv(lookup);
  let printed = 0;
  const csvRows: string[][] = [];

  for (const row of rows) {
    if (!isVariantRow(row)) continue;
    const handle = row.Handle!.trim();
    if (!handleSet.has(handle)) continue;
    const qty = qtyFromRow(row);
    if (qty <= 0) continue;
    const size = row["Option1 Value"]!.trim();
    const color2 = (row["Option2 Value"] ?? "").trim();
    const ref = enrichFrom99(handle, size, color2, byTriple, byHandleSize);
    const skuImp = ref?.sku ?? "";
    const colorImp = ref?.color ?? "";
    const colorDisplay = displayColourFromHandle(handle, colorImp || color2);
    const titleImp = ref?.title ?? "";
    printed += 1;
    const rec = [
      handle,
      size,
      color2,
      String(qty),
      skuImp,
      colorDisplay,
      titleImp,
    ];
    if (out) {
      csvRows.push(rec);
    } else {
      console.log(rec.join("\t"));
    }
  }

  if (out) {
    const body = [CSV_HEADER, ...csvRows]
      .map((cols) => cols.map(csvCell).join(","))
      .join("\n");
    fs.writeFileSync(out, `${body}\n`, "utf8");
    console.log(`Wrote ${printed} rows to ${out}`);
  }

  console.log(
    `\nRows in ${path.basename(lookup)} with qty > 0 for those handles: ${printed}`,
  );
  console.log(`SKU, colour, title from: ${path.basename(enrichFrom)}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
