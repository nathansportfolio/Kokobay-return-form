/**
 * SAFE Shopify metafield updater
 * ONLY updates colour metafield — nothing else
 *
 * Input:
 *   ./active-products.csv
 *
 * Output:
 *   ./shopify-colour-update.csv
 *
 * Run:
 *   node scripts/export-colour-metafield.js ./active-products.csv ./shopify-colour-update.csv
 */

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { Parser } = require("json2csv");

const INPUT = path.resolve(process.argv[2] || "./active-products.csv");
const OUTPUT = path.resolve(process.argv[3] || "./shopify-colour-update.csv");

/**
 * ONLY these fields will be sent to Shopify
 */
const FIELDS = [
  "Handle",
  "Title",
  "Color (product.metafields.shopify.color-pattern)"
];

function get(row, ...keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).length) {
      return String(row[k]).trim();
    }
  }
  return "";
}

function normalizeColour(colour) {
  if (!colour) return "";

  return colour
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()); // Title Case
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`Missing input file: ${INPUT}`);
    process.exit(1);
  }

  const rows = [];

  fs.createReadStream(INPUT, { encoding: "utf8" })
    .pipe(csv())
    .on("data", (row) => {
      const handle = get(row, "product_handle", "Handle");
      const title = get(row, "product_title", "Title");

      const colourRaw = get(
        row,
        "option2",
        "Option2 Value",
        "Color",
        "Colour"
      );

      const colour = normalizeColour(colourRaw);

      if (!handle || !title) return;

      rows.push({
        Handle: handle,
        Title: title,
        "Color (product.metafields.shopify.color-pattern)": colour
      });
    })
    .on("end", () => {
      if (!rows.length) {
        console.error("No rows processed.");
        process.exit(1);
      }

      const parser = new Parser({
        fields: FIELDS,
        withBOM: true
      });

      fs.writeFileSync(OUTPUT, parser.parse(rows), "utf8");

      console.log(`✅ Done. ${rows.length} rows written to: ${OUTPUT}`);
      console.log("👉 Safe to import into Shopify (metafield only).");
    })
    .on("error", (err) => {
      console.error(err);
      process.exit(1);
    });
}

main();