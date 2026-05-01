const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { Parser } = require("json2csv");

const INPUT = path.resolve(process.argv[2] || "./active-products.csv");
const OUTPUT = path.resolve(process.argv[3] || "./shopify-title-update.csv");

const FIELDS = ["Handle", "Title"];

function get(row, ...keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).length) {
      return String(row[k]).trim();
    }
  }
  return "";
}

function main() {
  const rows = [];

  fs.createReadStream(INPUT)
    .pipe(csv())
    .on("data", (row) => {
      const handle = get(row, "product_handle", "Handle");
      const baseTitle = get(row, "product_title", "Title");

      const colour = get(
        row,
        "option2",
        "Option2 Value",
        "Color",
        "Colour"
      );

      if (!handle || !baseTitle) return;

      // Avoid double adding colour
      let finalTitle = baseTitle;

      if (colour && !baseTitle.toLowerCase().includes(colour.toLowerCase())) {
        finalTitle = `${baseTitle} - ${colour}`;
      }

      rows.push({
        Handle: handle,
        Title: finalTitle
      });
    })
    .on("end", () => {
      const parser = new Parser({
        fields: FIELDS,
        withBOM: true
      });

      fs.writeFileSync(OUTPUT, parser.parse(rows));
      console.log(`✅ Titles ready: ${OUTPUT}`);
    });
}

main();