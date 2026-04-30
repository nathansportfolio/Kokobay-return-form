/**
 * Pass-through: `active-products.csv` → Shopify product import CSV.
 * No merging, no handle/title/SKU changes, no option renaming — only column
 * names and layout expected by Shopify (same data as your export).
 *
 * Prerequisite:
 *   pnpm list-active-products --out ./active-products.csv
 *
 * Run (from `kokobay/`):
 *   pnpm export-shopify-csv
 *   node scripts/export-shopify-import-csv.js ./active-products.csv ./shopify-import.csv
 *
 * Requires: `csv-parser`, `json2csv` (in package.json)
 */

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { Parser } = require("json2csv");

const INPUT = path.resolve(process.argv[2] || "./active-products.csv");
const OUTPUT = path.resolve(process.argv[3] || "./shopify-import.csv");

/** Product + variant row layout aligned with common Shopify product CSV import. */
const FIELDS = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Type",
  "Tags",
  "Collection",
  "Published",
  "Status",
  "Option1 Name",
  "Option1 Value",
  "Option2 Name",
  "Option2 Value",
  "Option3 Name",
  "Option3 Value",
  "Variant SKU",
  "Variant Barcode",
  "Variant Price",
  "Variant Compare At Price",
  "Variant Inventory Tracker",
  "Variant Inventory Qty",
  "Variant Taxable",
  "Variant Weight",
  "Variant Weight Unit",
  "Image Src",
  "product_images_src",
];

function get(row, ...keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).length) {
      return String(row[k]);
    }
  }
  return "";
}

function published(row) {
  const p = get(
    row,
    "product_published_at",
    "Published",
  );
  if (!p) return "FALSE";
  if (/^false$|^no$/i.test(p.trim())) return "FALSE";
  return "TRUE";
}

function optionNamesFromProduct(optionsJsonRaw) {
  const empty = ["", "", ""];
  const raw = String(optionsJsonRaw ?? "").trim();
  if (!raw) {
    return empty;
  }
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) {
      return empty;
    }
    const sorted = [...arr].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0),
    );
    return [0, 1, 2].map(
      (i) => (sorted[i]?.name != null ? String(sorted[i].name) : "") || "",
    );
  } catch {
    return empty;
  }
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(
      `Missing ${INPUT} — run: pnpm list-active-products --out ./active-products.csv`,
    );
    process.exit(1);
  }

  const rows = [];

  fs.createReadStream(INPUT, { encoding: "utf8" })
    .pipe(csv())
    .on("data", (row) => {
      const [n1, n2, n3] = optionNamesFromProduct(row.options_json);
      rows.push({
        Handle: get(row, "product_handle", "Handle"),
        Title: get(row, "product_title", "Title"),
        "Body (HTML)": get(row, "body_html", "Body (HTML)", "Body HTML"),
        Vendor: get(row, "product_vendor", "Vendor"),
        Type: get(row, "product_type", "Type"),
        Tags: get(row, "product_tags", "Tags"),
        Collection: get(row, "product_collections", "Collection"),
        Published: published(row),
        Status: get(
          row,
          "product_status",
          "Status",
        ).toLowerCase() === "active"
          ? "active"
          : get(row, "product_status", "Status") || "active",
        "Option1 Name": n1,
        "Option1 Value": get(row, "option1", "Option1 Value"),
        "Option2 Name": n2,
        "Option2 Value": get(row, "option2", "Option2 Value"),
        "Option3 Name": n3,
        "Option3 Value": get(row, "option3", "Option3 Value"),
        "Variant SKU": get(row, "sku", "Variant SKU", "SKU"),
        "Variant Barcode": get(row, "barcode", "Variant Barcode"),
        "Variant Price": get(row, "price", "Variant Price"),
        "Variant Compare At Price": get(
          row,
          "compare_at_price",
          "Variant Compare At Price",
        ),
        "Variant Inventory Tracker": get(
          row,
          "inventory_management",
          "Variant Inventory Tracker",
        ) || "shopify",
        "Variant Inventory Qty": get(
          row,
          "inventory_quantity",
          "Variant Inventory Qty",
        ),
        "Variant Taxable": get(
          row,
          "taxable",
          "Variant Taxable",
        ) || "true",
        "Variant Weight": get(
          row,
          "weight",
          "Variant Weight",
        ),
        "Variant Weight Unit": get(
          row,
          "weight_unit",
          "Variant Weight Unit",
        ),
        "Image Src": get(row, "image_src", "Image Src", "Image src"),
        product_images_src: get(
          row,
          "product_images_src",
          "Product Images Src",
        ),
      });
    })
    .on("end", () => {
      if (rows.length === 0) {
        console.error("No data rows in input.");
        process.exit(1);
      }
      const parser = new Parser({ fields: FIELDS, withBOM: true });
      fs.writeFileSync(OUTPUT, parser.parse(rows), "utf8");
      console.log(
        `Wrote ${rows.length} variant row(s) (pass-through) to ${OUTPUT}`,
      );
    })
    .on("error", (e) => {
      console.error(e);
      process.exit(1);
    });
}

main();
