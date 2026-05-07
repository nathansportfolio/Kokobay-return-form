const fs = require("fs");
const csv = require("csv-parser");
const { Parser } = require("json2csv");

/** Shopify variant export from `pnpm shopify-stock-export` (Handle, Title, options, SKU, qty). */
const INPUT = "./shopify-stock-live.csv";

// 🔥 CONTROL PRODUCTS HERE
const START_PRODUCT = 1;
const END_PRODUCT = 2;

console.log("🚀 SHOPIFY IMPORT SCRIPT RUNNING");

/* ------------------ LOAD CSV ------------------ */

function loadCsv(file) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(file)
      .pipe(csv())
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

function rowHandle(row) {
  return String(row.Handle || row.product_handle || "").trim();
}

function rowTitle(row) {
  return String(row.Title || row.product_title || "").trim();
}

/* ------------------ DETECTION ------------------ */

/* 🎨 COLOUR */
const COLOUR_MAP = [
  ["black", "Black"],
  ["white", "White"],

  // Neutrals
  ["cream", "Beige"],
  ["stone", "Beige"],
  ["oatmeal", "Beige"],
  ["beige", "Beige"],
  ["nude", "Beige"],
  ["taupe", "Brown"],

  // Browns
  ["mocha", "Brown"],
  ["chocolate", "Brown"],
  ["camel", "Brown"],
  ["tan", "Brown"],

  // Blue
  ["powder blue", "Blue"],
  ["navy", "Blue"],
  ["blue", "Blue"],

  // Green
  ["sage", "Green"],
  ["khaki", "Green"],
  ["olive", "Green"],
  ["green", "Green"],

  // Pink
  ["strawberry sorbet", "Pink"],
  ["blush", "Pink"],
  ["mauve", "Pink"],
  ["strawberry", "Pink"],
  ["pink", "Pink"],

  // Red
  ["wine", "Red"],
  ["cherry", "Red"],
  ["red", "Red"],

  // Yellow
  ["lemon", "Yellow"],
  ["yellow", "Yellow"],

  // Orange
  ["orange", "Orange"],

  // Purple
  ["plum", "Purple"],

  // Special
  ["pearl", "White"],
  ["metallic", "Metallic"],
  ["multi", "Multi"],
];

function detectColour(text) {
  const t = text.toLowerCase();

  // Ensure longer matches first (e.g. "powder blue")
  for (const [k, v] of COLOUR_MAP.sort((a, b) => b[0].length - a[0].length)) {
    if (t.includes(k)) return v;
  }

  return "";
}

/* 🐆 PATTERN */
const PATTERNS = ["floral", "leopard", "paisley", "snake", "polka", "dot"];

function detectPattern(text) {
  const t = text.toLowerCase();

  if (t.includes("polka") || t.includes("dot")) return "Polka Dot";

  for (const p of PATTERNS) {
    if (t.includes(p)) {
      return p.charAt(0).toUpperCase() + p.slice(1);
    }
  }

  return "";
}

/* 🧵 FABRIC */
const FABRICS = [
  "lace",
  "knit",
  "crochet",
  "velvet",
  "mesh",
  "sequin",
  "suede",
  "satin",
  "silk",
  "ribbed",
  "jersey",
];

function detectFabric(text) {
  const t = text.toLowerCase();

  for (const f of FABRICS) {
    if (t.includes(f)) {
      return f.charAt(0).toUpperCase() + f.slice(1);
    }
  }

  return "";
}

/* ✨ FEATURES */
function detectFeatures(text) {
  const t = text.toLowerCase();

  const mappings = [
    ["corset", "Corset"],
    ["backless", "Backless"],
    ["strapless", "Strapless"],
    ["ruched", "Ruched"],
    ["cowl", "Cowl"],
    ["tie side", "Tie Side"],
    ["tie up", "Tie Up"],
    ["underwire", "Underwire"],
    ["high neck", "High Neck"],
    ["o-ring", "O-Ring"],
    ["o ring", "O-Ring"],
  ];

  return mappings
    .filter(([k]) => t.includes(k))
    .map(([, v]) => v)
    .join(", ");
}

/* ------------------ MAIN ------------------ */

async function main() {
  const rows = await loadCsv(INPUT);

  // ✅ UNIQUE HANDLES
  const handles = [];
  const seen = new Set();

  for (const row of rows) {
    const h = rowHandle(row);
    if (!h || seen.has(h)) continue;
    seen.add(h);
    handles.push(h);
  }

  console.log("👉 Total handles:", handles.length);

  const selectedHandles = handles.slice(START_PRODUCT, END_PRODUCT);
  console.log("👉 Selected:", selectedHandles);

  // GROUP BY HANDLE
  const map = new Map();
  for (const row of rows) {
    const h = rowHandle(row);
    if (!map.has(h)) map.set(h, []);
    map.get(h).push(row);
  }

  const output = [];

  for (const handle of selectedHandles) {
    const productRows = map.get(handle);
    if (!productRows) continue;

    const title = rowTitle(productRows[0]);
    const seenSku = new Set();

    for (const row of productRows) {
      const sku = row["Variant SKU"] || row["sku"];
      if (!sku || seenSku.has(sku)) continue;
      seenSku.add(sku);

      const size = String(row["Option1 Value"] || "").trim();
      if (!size) continue;
      const rawColour = row["Option2 Value"] || handle.split("-").pop();

      const combined = `${title} ${rawColour}`;

      let colour = detectColour(combined);

      // patterns = multicolor
      if (!colour && detectPattern(combined)) {
        colour = "Multicolor";
      }

      // optional fallback
      if (!colour) {
        colour = "";
}
      const pattern = detectPattern(combined);
      const fabric = detectFabric(combined);
      const features = detectFeatures(combined);
      const featureList = [
        pattern && pattern !== "Polka Dot" ? pattern : null,
        ...features.split(",").map(f => f.trim()).filter(Boolean),
      ].filter(Boolean);
      const price = String(
        row["Variant Price"] ?? row.price ?? row["Price"] ?? "",
      ).trim();

      output.push({
        Handle: handle,
        Title: title,
        Vendor: row["Vendor"] || "Koko Bay",
        Published: "TRUE",

        "Option1 Name": String(row["Option1 Name"] || "").trim() || "Size",
        "Option1 Value": size,
        "Option2 Name": String(row["Option2 Name"] || "").trim() || "Color",
        "Option2 Value": rawColour,

        "Variant SKU": sku,
        "Variant Price": price,

        // ✅ METAFIELDS
        "Variant Metafield: custom.colour": colour,
"Variant Metafield: custom.fabric": fabric,
"Variant Metafield: custom.features": featureList.join(","),
      });
    }
  }

  const parser = new Parser();
  const fileName = `shopify-import-${START_PRODUCT}-${END_PRODUCT}.csv`;

  fs.writeFileSync(fileName, parser.parse(output), "utf8");

  console.log("✅ DONE");
  console.log(`📁 ${fileName}`);
}

main();