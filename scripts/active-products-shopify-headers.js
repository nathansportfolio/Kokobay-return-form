/**
 * Rewrites a raw `active-products.csv` (from list-active-products) to Shopify-style column
 * titles only — same values per row (handles, titles, SKUs, etc. unchanged). Does not merge
 * variants or rewrite slugs; use `merge-products.js` for that.
 *
 *   node scripts/active-products-shopify-headers.js [input.csv] [output.csv]
 *   pnpm active-products-shopify-headers
 *
 * Defaults: ./active-products.csv → ./active-products-shopify-headers.csv
 */

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { Parser, formatters: csvFormatters } = require("json2csv");
const {
  SHOPIFY_CSV_FIELDS,
  rowToShopifyCsv
} = require("./active-products-csv-map.js");

const INPUT = path.resolve(process.argv[2] || "./active-products.csv");
const OUTPUT = path.resolve(process.argv[3] || "./active-products-shopify-headers.csv");

function normalizeCsvRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[String(k).replace(/^\ufeff/, "").trim()] = v;
  }
  return out;
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`Missing ${INPUT}`);
    process.exit(1);
  }

  const rows = [];
  fs.createReadStream(INPUT, { encoding: "utf8" })
    .pipe(csv())
    .on("data", r => rows.push(rowToShopifyCsv(normalizeCsvRow(r))))
    .on("end", () => {
      if (rows.length === 0) {
        console.error("No rows in input.");
        process.exit(1);
      }
      const parser = new Parser({
        fields: SHOPIFY_CSV_FIELDS,
        withBOM: false,
        delimiter: ",",
        eol: "\n",
        header: true,
        formatters: {
          string: csvFormatters.string({ quote: '"', escapedQuote: '""' })
        }
      });
      fs.writeFileSync(OUTPUT, parser.parse(rows), "utf8");
      console.error(`Wrote ${rows.length} row(s) → ${OUTPUT}`);
    })
    .on("error", e => {
      console.error(e);
      process.exit(1);
    });
}

main();
