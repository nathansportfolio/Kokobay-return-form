/**
 * Lists distinct **colour** values across Shopify products (Admin REST).
 *
 * Uses product `options`: any option whose name matches “color” / “colour”
 * (case-insensitive). Collects each option’s `values[]` plus variant picks at
 * those positions so nothing is missed.
 *
 * Fallback when no colour-named option exists: **Option2** only (matches
 * `merge-products` convention: Option1 = Size, Option2 = Color).
 *
 * Env: `.env.local` — same credentials as `list-active-products`.
 *
 * From repo root:
 *   pnpm list-product-colours
 *   pnpm list-product-colours --json
 *   pnpm list-product-colours --all-statuses   # draft + archived too
 */

import { fetchAllShopifyProducts } from "@/lib/fetchAllShopifyProducts";
import type { ShopifyOption, ShopifyProduct, ShopifyVariant } from "@/types/shopify";

function safeString(value: unknown): string {
  return String(value ?? "").trim();
}

function isColourOptionName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("color") || n.includes("colour");
}

/** 1-based Shopify option position → variant field. */
function variantValueAtPosition(
  v: ShopifyVariant,
  position: number,
): string {
  switch (position) {
    case 1:
      return safeString(v.option1);
    case 2:
      return safeString(v.option2 ?? "");
    case 3:
      return safeString(v.option3 ?? "");
    default:
      return "";
  }
}

/**
 * Positions (1-based) that hold colour for this product.
 */
function colourPositionsForProduct(options: ShopifyOption[]): number[] {
  const sorted = [...(options ?? [])].sort((a, b) => a.position - b.position);
  const fromName = sorted
    .filter((o) => isColourOptionName(safeString(o.name)))
    .map((o) => o.position)
    .filter((p) => p >= 1 && p <= 3);
  if (fromName.length > 0) return [...new Set(fromName)].sort((a, b) => a - b);
  return [2];
}

function collectColoursFromProduct(p: ShopifyProduct, into: Map<string, string>) {
  const positions = colourPositionsForProduct(p.options ?? []);

  for (const o of p.options ?? []) {
    if (!positions.includes(o.position)) continue;
    const nameOk =
      isColourOptionName(safeString(o.name)) ||
      (positions.length === 1 && positions[0] === 2);
    if (!nameOk) continue;
    for (const val of o.values ?? []) {
      const s = safeString(val);
      if (!s) continue;
      const key = s.toLowerCase();
      if (!into.has(key)) into.set(key, s);
    }
  }

  for (const v of p.variants ?? []) {
    for (const pos of positions) {
      const s = variantValueAtPosition(v, pos);
      if (!s) continue;
      const key = s.toLowerCase();
      if (!into.has(key)) into.set(key, s);
    }
  }
}

function parseArgs(): { json: boolean; allStatuses: boolean } {
  return {
    json: process.argv.includes("--json"),
    allStatuses: process.argv.includes("--all-statuses"),
  };
}

function activeProductsOnly(products: ShopifyProduct[]): ShopifyProduct[] {
  return products.filter((p) => String(p.status ?? "").toLowerCase() === "active");
}

function main() {
  const { json, allStatuses } = parseArgs();

  void (async () => {
    const r = await fetchAllShopifyProducts(
      allStatuses ? undefined : { status: "active" },
    );
    if (!r.ok) {
      console.error("Error:", r.error);
      process.exitCode = 1;
      return;
    }
    const products = allStatuses ? r.products : activeProductsOnly(r.products);
    const dropped = allStatuses ? 0 : r.products.length - products.length;
    if (dropped > 0) {
      console.error(
        `Filtered out ${dropped} non-active product(s) (use --all-statuses for every status).`,
      );
    }

    const colours = new Map<string, string>();
    for (const p of products) {
      collectColoursFromProduct(p, colours);
    }

    const list = [...colours.values()].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );

    if (json) {
      process.stdout.write(`${JSON.stringify(list, null, 2)}\n`);
      console.error(`${list.length} distinct colour value(s) from ${products.length} product(s).`);
      return;
    }

    console.error(
      `${list.length} distinct colour value(s) from ${products.length} product(s). One per line:`,
    );
    for (const c of list) {
      process.stdout.write(`${c}\n`);
    }
  })();
}

main();
