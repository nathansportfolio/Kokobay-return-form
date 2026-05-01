/**
 * Fetches **active** Shopify products only (Admin REST, paginated) and lists
 * variants with no SKU, with **proposed SKUs** using the same rules as
 * `merge-products.js` (`scripts/merge-sku-rules.js`: canonical vs deterministic
 * base `{product_code}-{TYPE}-{COLOUR}-{SIZE}`, global `ensureUniqueSku` de-dup).
 *
 * Option mapping matches merge CSV: **Option1 = size**, **Option2 = color**
 * (and handle tail for color when option2 is empty), same skip rule when
 * there is no size or color stays Default.
 *
 * Handle order for the allocator follows `compareHandlesForRange` (same as
 * merge `--range` list ordering). Variant order within a product follows
 * merge’s numeric `product_id` sort (`variant.id` ascending).
 *
 * Env (e.g. `.env.local`): `SHOPIFY_STORE` and credentials for Admin REST.
 *
 * From repo root:
 *   pnpm missing-variant-skus
 *   pnpm missing-variant-skus --json
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { fetchAllShopifyProducts } from "@/lib/fetchAllShopifyProducts";
import type { ShopifyProduct, ShopifyVariant } from "@/types/shopify";

const require = createRequire(fileURLToPath(import.meta.url));
const skuRules = require("./merge-sku-rules.js") as {
  safeString: (value: unknown) => string;
  formatVariantWords: (text: unknown) => string;
  isCanonicalSkuFormat: (s: string) => boolean;
  buildDeterministicSkuBase: (
    displayTitle: string,
    titleLower: string,
    colourDisplay: string,
    sizeRaw: string,
  ) => string;
  createSkuAllocator: () => { ensureUniqueSku: (desired: string) => string };
  compareHandlesForRange: (a: string, b: string) => number;
};

const {
  safeString,
  formatVariantWords,
  isCanonicalSkuFormat,
  buildDeterministicSkuBase,
  createSkuAllocator,
  compareHandlesForRange,
} = skuRules;

function skuIsMissing(sku: unknown): boolean {
  if (sku == null) return true;
  return String(sku).trim() === "";
}

/** Same as merge `firstDisplayTitleFromRows` when only one logical row exists. */
function displayTitleFromProduct(p: ShopifyProduct): string {
  const t = safeString(
    String(p.title ?? "")
      .split(/\s*-\s*/)
      .slice(0, -1)
      .join(" - "),
  );
  if (t) return t;
  return safeString(String(p.handle ?? "").replace(/-/g, " "));
}

/** Same construction as merge `titleLower` for a product group. */
function titleLowerFromProduct(p: ShopifyProduct): string {
  const titles = [String(p.title || "").toLowerCase()];
  const handleLower = safeString(p.handle).toLowerCase().replace(/-/g, " ");
  return [...titles, handleLower].join(" ").trim();
}

/**
 * Size / color and whether merge-products would skip emitting this variant row
 * (`if (!size || color.toLowerCase() === "default") return`).
 */
function variantSizeColorLikeMerge(
  v: Pick<ShopifyVariant, "option1" | "option2">,
  productHandle: string,
): { size: string; color: string; mergeSkipsRow: boolean } {
  const size = safeString(v.option1);
  const option2FromCsv = safeString(v.option2 ?? "");
  let color = option2FromCsv ? formatVariantWords(option2FromCsv) : "Default";
  if (!option2FromCsv && productHandle.includes("-")) {
    const tail = productHandle.split("-").pop() || "";
    if (tail && color.toLowerCase() === "default") {
      color = formatVariantWords(tail);
    }
  }
  const mergeSkipsRow = !size || color.toLowerCase() === "default";
  return { size, color, mergeSkipsRow };
}

function sortedVariants(vs: ShopifyVariant[]): ShopifyVariant[] {
  return [...vs].sort((a, b) =>
    String(a.id).localeCompare(String(b.id), undefined, { numeric: true }),
  );
}

type MissingVariantRow = {
  id: number;
  title: string;
  option1: string;
  option2: string;
  /** What merge-products would assign after `ensureUniqueSku` (null if merge skips the row). */
  proposedSku: string | null;
  /** Non-empty when `proposedSku` is null — explains merge skip or unexpected state. */
  mergeNote: string;
};

type ReportRow = {
  handle: string;
  id: number;
  title: string;
  status: string;
  missingVariantCount: number;
  variantCount: number;
  missingVariants: MissingVariantRow[];
};

const MERGE_SKIP_NOTE =
  "merge-products skips this variant (no Option1/size or color is Default) — no SKU rule applied";

function tsvCell(s: string): string {
  return s.replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

function buildReport(products: ShopifyProduct[]): ReportRow[] {
  const sortedProducts = [...products].sort((a, b) =>
    compareHandlesForRange(a.handle, b.handle),
  );
  const allocator = createSkuAllocator();
  const byHandle = new Map<string, ReportRow>();

  for (const p of sortedProducts) {
    const displayTitle = displayTitleFromProduct(p);
    const titleLower = titleLowerFromProduct(p);
    const variants = sortedVariants(p.variants ?? []);
    const variantCount = variants.length;

    for (const v of variants) {
      const { size, color, mergeSkipsRow } = variantSizeColorLikeMerge(v, p.handle);
      const rawSku = safeString(v.sku);
      let assignedForRow: string | null = null;

      if (!mergeSkipsRow) {
        if (rawSku && isCanonicalSkuFormat(rawSku)) {
          assignedForRow = allocator.ensureUniqueSku(rawSku);
        } else {
          const base = buildDeterministicSkuBase(
            displayTitle,
            titleLower,
            color,
            size,
          );
          assignedForRow = allocator.ensureUniqueSku(base);
        }
      }

      if (!skuIsMissing(v.sku)) continue;

      const proposedSku = mergeSkipsRow ? null : assignedForRow;
      const mergeNote = mergeSkipsRow ? MERGE_SKIP_NOTE : "";

      let row = byHandle.get(p.handle);
      if (!row) {
        row = {
          handle: p.handle,
          id: p.id,
          title: p.title,
          status: p.status,
          missingVariantCount: 0,
          variantCount,
          missingVariants: [],
        };
        byHandle.set(p.handle, row);
      }
      row.missingVariantCount += 1;
      row.missingVariants.push({
        id: v.id,
        title: v.title,
        option1: size,
        option2: color,
        proposedSku,
        mergeNote,
      });
    }
  }

  return [...byHandle.values()].sort((a, b) =>
    compareHandlesForRange(a.handle, b.handle),
  );
}

function parseArgs(): { json: boolean } {
  return {
    json: process.argv.includes("--json"),
  };
}

/** Only products Shopify marks `status: "active"` (excludes draft/archived). */
function activeProductsOnly(products: ShopifyProduct[]): ShopifyProduct[] {
  return products.filter((p) => String(p.status ?? "").toLowerCase() === "active");
}

function printTsv(report: ReportRow[]) {
  const cols = [
    "Handle",
    "Variant ID",
    "Option1 Value (size)",
    "Option2 Value (color)",
    "Proposed Variant SKU",
    "Note",
  ];
  process.stdout.write(`${cols.join("\t")}\n`);
  for (const pr of report) {
    for (const mv of pr.missingVariants) {
      process.stdout.write(
        [
          tsvCell(pr.handle),
          String(mv.id),
          tsvCell(mv.option1),
          tsvCell(mv.option2),
          mv.proposedSku != null ? tsvCell(mv.proposedSku) : "",
          tsvCell(mv.mergeNote),
        ].join("\t") + "\n",
      );
    }
  }
}

function main() {
  const { json } = parseArgs();

  void (async () => {
    const r = await fetchAllShopifyProducts({ status: "active" });
    if (!r.ok) {
      console.error("Error:", r.error);
      process.exitCode = 1;
      return;
    }
    const products = activeProductsOnly(r.products);
    const dropped = r.products.length - products.length;
    if (dropped > 0) {
      console.error(
        `Filtered out ${dropped} non-active product(s) from the API response (draft/archived).`,
      );
    }
    const report = buildReport(products);
    if (json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      console.error(
        `${report.length} product handle(s) with missing SKU on at least one variant (${products.length} active product(s)).`,
      );
      return;
    }
    const variantRows = report.reduce((n, p) => n + p.missingVariants.length, 0);
    console.error(
      `Using ${products.length} active product(s). ${report.length} handle(s), ${variantRows} variant row(s) missing SKU. TSV on stdout (see header).`,
    );
    printTsv(report);
  })();
}

main();