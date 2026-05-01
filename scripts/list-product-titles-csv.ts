/**
 * CSV export: **Handle**, **Title** for **active** Shopify products only (Admin REST,
 * paginated). Uses `status=active` on the API and keeps rows whose `product.status`
 * is `"active"` so drafts/archived never appear.
 *
 * Env: `.env.local` — `SHOPIFY_STORE` + Admin credentials (same as `list-active-products`).
 *
 * From repo root:
 *   pnpm list-product-titles-csv
 *   pnpm list-product-titles-csv --out ./titles.csv
 */

import { writeFileSync } from "node:fs";

import { fetchAllShopifyProducts } from "@/lib/fetchAllShopifyProducts";
import type { ShopifyProduct } from "@/types/shopify";

function csvCell(value: string): string {
  const s = String(value ?? "");
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function parseArgs(): { outPath: string | null } {
  const outIdx = process.argv.indexOf("--out");
  const outPath =
    outIdx >= 0 && process.argv[outIdx + 1] ? process.argv[outIdx + 1] : null;
  return { outPath };
}

function activeProductsOnly(products: ShopifyProduct[]): ShopifyProduct[] {
  return products.filter((p) => String(p.status ?? "").toLowerCase() === "active");
}

function main() {
  const { outPath } = parseArgs();

  void (async () => {
    const r = await fetchAllShopifyProducts({ status: "active" });
    if (!r.ok) {
      console.error("Error:", r.error);
      process.exitCode = 1;
      return;
    }

    const active = activeProductsOnly(r.products);
    const dropped = r.products.length - active.length;
    if (dropped > 0) {
      console.error(
        `Filtered out ${dropped} non-active product(s) from the API response.`,
      );
    }

    const rows = active.map((p) => ({
      handle: String(p.handle ?? "").trim(),
      title: String(p.title ?? "").trim(),
    }));

    rows.sort((a, b) =>
      a.handle.localeCompare(b.handle, undefined, { sensitivity: "base" }),
    );

    const lines = [
      ["Handle", "Title"].join(","),
      ...rows.map((row) => [csvCell(row.handle), csvCell(row.title)].join(",")),
    ];
    const text = `${lines.join("\n")}\n`;

    if (outPath) {
      writeFileSync(outPath, text, "utf8");
      console.error(`Wrote ${rows.length} row(s) to ${outPath}`);
    } else {
      process.stdout.write(text);
    }
  })();
}

main();
