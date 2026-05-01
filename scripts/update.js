const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { Parser } = require("json2csv");

/** Source of truth: Handle → Title (exact strings, casing, punctuation). */
const INPUTRAW = "./active-products.csv";

/** Variant data: correct SKUs, options, prices (structure for output rows). */
const INPUT = "./active-products-3.csv";

// 🔥 CONTROL PRODUCTS HERE (slice on handle order from INPUT / active-products-3)
const START_PRODUCT = 200;
const END_PRODUCT = 300;

function rowHandle(row) {
  return String(row.Handle || row.product_handle || "").trim();
}

function rowTitle(row) {
  return String(row.Title || row.product_title || "").trim();
}

/**
 * First non-empty Title wins per handle (matches typical Shopify export rows).
 */
function buildTitleByHandle(rows) {
  const map = new Map();
  for (const row of rows) {
    const h = rowHandle(row);
    if (!h) continue;
    const t = rowTitle(row);
    if (!t || map.has(h)) continue;
    map.set(h, t);
  }
  return map;
}

function loadCsv(resolvedPath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(resolvedPath)
      .pipe(csv())
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

async function main() {
  const rawPath = path.resolve(process.cwd(), INPUTRAW);
  const dataPath = path.resolve(process.cwd(), INPUT);

  if (!fs.existsSync(rawPath)) {
    console.error("❌ File not found:", INPUTRAW);
    process.exit(1);
  }
  if (!fs.existsSync(dataPath)) {
    console.error("❌ File not found:", INPUT);
    process.exit(1);
  }

  let titleByHandle;
  try {
    titleByHandle = buildTitleByHandle(await loadCsv(rawPath));
  } catch (e) {
    console.error("❌ Failed to read", INPUTRAW, e);
    process.exit(1);
  }

  let allRows;
  try {
    allRows = await loadCsv(dataPath);
  } catch (e) {
    console.error("❌ Failed to read", INPUT, e);
    process.exit(1);
  }

  if (!allRows.length) {
    console.log("⚠️ No data in", INPUT);
    return;
  }

  const productMap = new Map();

  for (const row of allRows) {
    const handle = rowHandle(row);
    if (!handle) continue;

    if (!productMap.has(handle)) {
      productMap.set(handle, []);
    }

    productMap.get(handle).push(row);
  }

  const handles = Array.from(productMap.keys());
  const selectedHandles = handles.slice(START_PRODUCT, END_PRODUCT);

  const outputRows = [];
  let missingTitleHandles = 0;

  for (const handle of selectedHandles) {
    const canonicalTitle = titleByHandle.get(handle);
    if (!canonicalTitle) {
      missingTitleHandles += 1;
      console.warn(
        `⚠️ No title in ${INPUTRAW} for handle "${handle}" — skipped.`,
      );
      continue;
    }

    const rawRows = productMap.get(handle);
    if (!rawRows) continue;

    const seen = new Set();
    const productRows = [];

    for (const row of rawRows) {
      const sku = row["Variant SKU"] || row["sku"];

      if (!sku) continue;

      if (seen.has(sku)) continue;

      seen.add(sku);
      productRows.push(row);
    }

    if (!productRows.length) continue;

    for (const row of productRows) {
      outputRows.push({
        Handle: rowHandle(row),
        Title: canonicalTitle,

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
    if (missingTitleHandles > 0) {
      console.log(
        `   (${missingTitleHandles} handle(s) missing from ${INPUTRAW})`,
      );
    }
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
  console.log(`📦 Handles in slice: ${selectedHandles.length}`);
  console.log(`📄 Rows output: ${outputRows.length}`);
  console.log(`📁 File: ${outputName}`);
  console.log(`📌 Titles from: ${INPUTRAW}`);
  if (missingTitleHandles > 0) {
    console.log(`⚠️ Skipped (no title in raw): ${missingTitleHandles}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
