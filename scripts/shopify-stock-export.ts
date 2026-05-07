import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
// @ts-expect-error json2csv has no bundled types
import { Parser } from "json2csv";

import { fetchAllShopifyProducts } from "../lib/fetchAllShopifyProducts";
import {
  fetchInventoryAvailableSumByInventoryItemIds,
  inventoryItemIdFromVariant,
} from "../lib/fetchInventoryAvailableSumByInventoryItemIds";

/** Repo root (parent of `scripts/`), so the CSV always lands in the project root. */
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/**
 * One CSV row per variant: live **Handle**, **Title**, **Status**, options, SKU,
 * **Variant Inventory Qty** — summed **`available`** from Admin **inventory_levels**
 * (multi-location accurate). Falls back to REST variant `inventory_quantity` when
 * no `inventory_item_id` is returned.
 *
 * Run from repo root:
 *   pnpm shopify-stock-export
 *   pnpm shopify-stock-export -- --out shopify-stock-latest.csv
 *   pnpm shopify-stock-export -- --all-statuses   # include draft + archived
 *
 * Output is always under the **repo root**: relative `--out` is resolved from
 * there; an absolute `--out` (e.g. `/tmp/foo.csv`) uses only the **filename**
 * so the CSV is never written under `/tmp`.
 * Default file: `shopify-stock-live.csv`.
 *
 * **Default: active products only** (same as storefront). Pass `--all-statuses`
 * to request every product status the Admin API returns.
 *
 * Env: SHOPIFY_STORE, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET
 */

function resolveOutPath(out: string): string {
  if (path.isAbsolute(out)) {
    return path.join(REPO_ROOT, path.basename(out));
  }
  return path.resolve(REPO_ROOT, out);
}

type Row = {
  Handle: string;
  Title: string;
  Status: string;
  "Variant ID": number;
  "Variant Title": string;
  "Variant SKU": string | null;
  /** REST variant `price` (shop currency), for imports / metafield tooling. */
  "Variant Price": string;
  "Variant Inventory Qty": number;
  "Option1 Name": string;
  "Option1 Value": string;
  "Option2 Name": string;
  "Option2 Value": string;
};

function parseArgs(argv: string[]): { out: string; activeOnly: boolean } {
  let out = "shopify-stock-live.csv";
  let activeOnly = true;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out" && argv[i + 1]) {
      out = argv[i + 1]!;
      i += 1;
    } else if (argv[i] === "--all-statuses") {
      activeOnly = false;
    } else if (argv[i] === "--active") {
      activeOnly = true;
    }
  }
  return { out, activeOnly };
}

async function main() {
  const { out: outArg, activeOnly } = parseArgs(process.argv.slice(2));
  const out = resolveOutPath(outArg);

  console.log(
    `Fetching Shopify products (${activeOnly ? "active only" : "all statuses"})…\n`,
  );

  const res = await fetchAllShopifyProducts(
    activeOnly ? { status: "active" } : undefined,
  );

  if (!res.ok) {
    console.error("Failed:", res.error);
    process.exitCode = 1;
    return;
  }

  const inventoryItemIds: number[] = [];
  for (const product of res.products) {
    for (const v of product.variants || []) {
      const iid = inventoryItemIdFromVariant(v);
      if (iid != null) inventoryItemIds.push(iid);
    }
  }

  console.log(
    "Fetching inventory levels (sum of available across locations)…\n",
  );
  const qtyByInventoryItemId =
    await fetchInventoryAvailableSumByInventoryItemIds(inventoryItemIds);

  const rows: Row[] = [];

  for (const product of res.products) {
    const handle = product.handle;
    const opts = [...(product.options ?? [])].sort(
      (a, b) => a.position - b.position,
    );
    const opt1Name = opts[0]?.name ?? "";
    const opt2Name = opts[1]?.name ?? "";

    for (const v of product.variants || []) {
      const o1 = v.option1 ?? "";
      const o2 = v.option2 ?? "";
      const iid = inventoryItemIdFromVariant(v);
      const fromLevels =
        iid != null && qtyByInventoryItemId.has(iid)
          ? qtyByInventoryItemId.get(iid)!
          : null;
      const qty =
        fromLevels != null
          ? fromLevels
          : Math.max(0, Math.trunc(Number(v.inventory_quantity ?? 0)));
      rows.push({
        Handle: handle,
        Title: product.title,
        Status: product.status,
        "Variant ID": v.id,
        "Variant Title": v.title,
        "Variant SKU": v.sku,
        "Variant Price": String(v.price ?? "").trim(),
        "Variant Inventory Qty": qty,
        "Option1 Name": opt1Name,
        "Option1 Value": o1,
        "Option2 Name": opt2Name,
        "Option2 Value": o2,
      });
    }
  }

  const parser = new Parser({
    fields: [
      "Handle",
      "Title",
      "Status",
      "Variant ID",
      "Variant Title",
      "Variant SKU",
      "Variant Price",
      "Variant Inventory Qty",
      "Option1 Name",
      "Option1 Value",
      "Option2 Name",
      "Option2 Value",
    ],
  });

  fs.writeFileSync(out, parser.parse(rows), "utf8");

  console.log(`Products: ${res.products.length}`);
  console.log(`Variant rows: ${rows.length}`);
  console.log(`Wrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
