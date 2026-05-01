const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { Parser } = require("json2csv");

const INPUT = "./active-products-3.csv";

// 🔥 CONTROL PRODUCTS HERE
const START_PRODUCT = 300;
const END_PRODUCT = 350;

// -----------------------------
// GET COLOUR FROM ROW
// -----------------------------
function getColourFromRow(row) {
  const option1Name = (row["Option1 Name"] || "").toLowerCase();
  const option2Name = (row["Option2 Name"] || "").toLowerCase();

  if (option1Name.includes("color") || option1Name.includes("colour")) {
    return row["Option1 Value"];
  }

  if (option2Name.includes("color") || option2Name.includes("colour")) {
    return row["Option2 Value"];
  }

  return "";
}

// -----------------------------
// FORMAT COLOUR
// -----------------------------
function formatColour(colour) {
  return String(colour || "")
    .trim()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

// -----------------------------
// CLEAN TITLE
// -----------------------------
function cleanTitle(title) {
  return String(title || "")
    .replace(/\s-\s.*$/, "")
    .trim();
}

// -----------------------------
// MAIN
// -----------------------------
function main() {
  if (!fs.existsSync(INPUT)) {
    console.error("❌ File not found:", INPUT);
    process.exit(1);
  }

  const allRows = [];

  fs.createReadStream(INPUT)
    .pipe(csv())
    .on("data", (row) => {
      allRows.push(row);
    })
    .on("end", () => {
      if (!allRows.length) {
        console.log("⚠️ No data");
        return;
      }

      // 🔥 GROUP BY PRODUCT (HANDLE)
      const productMap = new Map();

      for (const row of allRows) {
        const handle = row["Handle"];
        if (!handle) continue;

        if (!productMap.has(handle)) {
          productMap.set(handle, []);
        }

        productMap.get(handle).push(row);
      }

      const handles = Array.from(productMap.keys());
      const selectedHandles = handles.slice(START_PRODUCT, END_PRODUCT);

      const outputRows = [];

      for (const handle of selectedHandles) {
        const rawRows = productMap.get(handle);
        if (!rawRows) continue;

        // 🔥 REMOVE DUPLICATES + KEEP ONLY REAL VARIANTS
        const seen = new Set();
        const productRows = [];

        for (const row of rawRows) {
          const sku = row["Variant SKU"] || row["sku"];

          // skip empty rows (images / junk)
          if (!sku) continue;

          if (seen.has(sku)) continue;

          seen.add(sku);
          productRows.push(row);
        }

        if (!productRows.length) continue;

        // 🔥 GET CLEAN TITLE + COLOUR FROM FIRST VALID ROW
        const firstRow = productRows[0];

        const baseTitle = cleanTitle(firstRow["Title"]);
        const colourRaw = getColourFromRow(firstRow);

        if (!baseTitle || !colourRaw) continue;

        const colour = formatColour(colourRaw);
        const newTitle = `${baseTitle} - ${colour}`;

        // 🔥 APPLY TO ALL VARIANTS
        for (const row of productRows) {
          outputRows.push({
            Handle: row["Handle"],
            Title: newTitle,

            "Option1 Name": row["Option1 Name"],
            "Option1 Value": row["Option1 Value"],
            "Option2 Name": row["Option2 Name"],
            "Option2 Value": row["Option2 Value"],

            "Variant SKU": row["Variant SKU"] || row["sku"],
            "Variant Price": row["Variant Price"] || row["price"],
          });
        }
      }

      if (!outputRows.length) {
        console.log("⚠️ No products processed");
        return;
      }

      const outputName = `shopify-update-products-${START_PRODUCT}-to-${END_PRODUCT}.csv`;
      const outputPath = path.join(process.cwd(), outputName);

      const parser = new Parser({
        fields: [
          "Handle",
          "Title",
          "Option1 Name",
          "Option1 Value",
          "Option2 Name",
          "Option2 Value",
          "Variant SKU",
          "Variant Price",
        ],
      });

      fs.writeFileSync(outputPath, parser.parse(outputRows), "utf8");

      console.log("✅ DONE");
      console.log(`📦 Products processed: ${selectedHandles.length}`);
      console.log(`📄 Rows output: ${outputRows.length}`);
      console.log(`📁 File: ${outputName}`);
    })
    .on("error", (err) => {
      console.error(err);
      process.exit(1);
    });
}

main();