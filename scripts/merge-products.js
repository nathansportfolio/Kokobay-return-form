/**
 * Shopify product CSV — **SAFE UPDATE MODE** (one output product per distinct `product_handle`).
 *
 * **Not written / not derived:** `Tags`, collections (no `Collection` column, no collection→tag merge).
 * **Handle** = original `product_handle` (trimmed), grouped by exact string only.
 *
 * **Intended updates:** `Type`, `Product Category`, images, variant price / inventory / grams /
 * SKU / variant image, size & color options — from list-active source rows.
 *
 * INPUT: `pnpm list-active-products --csv` (or compatible). OUTPUT: Shopify import CSV.
 *
 * Usage: `pnpm merge-products [input.csv] [output.csv] [chunk]`
 *        `pnpm merge-products [in.csv] [out.csv] --range START,END`
 *
 * **`--range`** / **chunk**: slice the handle list after sorting. Sort uses each handle’s logical slug:
 * leading **`copy-of-`** / **`copy-`** (Shopify duplicate URLs) is stripped **only for ordering** — output
 * **`Handle`** strings are unchanged. Raw A–Z would put `copy-…` before `the-…`; stripping fixes that.
 */

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { Parser, formatters: csvFormatters } = require("json2csv");
const { normalizeCsvRow } = require("./csvParserNormalize");
const {
  safeString,
  formatVariantWords,
  isCanonicalSkuFormat,
  buildDeterministicSkuBase,
  createSkuAllocator,
  compareHandlesForRange
} = require("./merge-sku-rules.js");

/** Handles per chunk when using legacy numeric chunk arg (same ordering as range slicing). */
const HANDLE_CHUNK_SIZE = 10;

/** @returns {{ input: string; output: string; chunk: number | null; range: { start: number; end: number } | null }} */
function parseMergeCli(argv) {
  const args = argv.slice(2);
  /** @type {{ start: number; end: number } | null} */
  let range = null;
  const filtered = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--range" && args[i + 1] != null) {
      range = parseRangeString(args[++i]);
      continue;
    }
    filtered.push(a);
  }
  return {
    input: path.resolve(filtered[0] || "./active-products-2.csv"),
    output: path.resolve(filtered[1] || "./strict-fixed-merged-products.csv"),
    chunk: parseChunkArg(filtered[2]),
    range
  };
}

const { input: INPUT_FILE, output: OUTPUT_FILE, chunk: CHUNK_NUMBER_FROM_CLI, range: RANGE_FROM_CLI } =
  parseMergeCli(process.argv);

function parseChunkArg(arg) {
  if (arg == null || arg === "") return null;
  const n = Number.parseInt(String(arg).trim(), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

/** Inclusive 1-based START,END → slice into alphabetically sorted handle list. */
function parseRangeString(s) {
  const parts = String(s)
    .trim()
    .split(/[,\s]+/)
    .map(x => x.trim())
    .filter(Boolean);
  if (parts.length !== 2) return null;
  const start = Number.parseInt(parts[0], 10);
  const end = Number.parseInt(parts[1], 10);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 1 ||
    end < start
  ) {
    return null;
  }
  return { start, end };
}

/** Prefer `--range`; else legacy 4th-arg chunk (fixed page size). */
const CHUNK_NUMBER =
  RANGE_FROM_CLI != null ? null : CHUNK_NUMBER_FROM_CLI;

function getCategory(titleLower, productTypeStandard) {
  const t = titleLower;

  if (t.includes("bikini bottom")) {
    return "Apparel & Accessories > Clothing > Swimwear > Swim Briefs";
  }

  if (t.includes("bikini top")) {
    return "Apparel & Accessories > Clothing > Swimwear > Swimwear Tops";
  }

  if (t.includes("swimsuit")) {
    return "Apparel & Accessories > Clothing > Swimwear > One-Piece Swimsuits";
  }

  if (t.includes("sarong")) {
    return "Apparel & Accessories > Clothing > Swimwear > Cover Ups";
  }

  switch (productTypeStandard) {
    case "Top":
      return "Apparel & Accessories > Clothing > Clothing Tops";

    case "Dress":
      return "Apparel & Accessories > Clothing > Dresses";

    case "Skirt":
      return "Apparel & Accessories > Clothing > Skirts";

    case "Trouser":
      return "Apparel & Accessories > Clothing > Pants";

    case "Shorts":
      return "Apparel & Accessories > Clothing > Shorts";

    case "Bottom":
      return "Apparel & Accessories > Clothing > Swimwear > Swim Briefs";

    default:
      return "";
  }
}

/** Allowed Product Type values (Shopify Type / product_type_standard metafield). */
const BROAD_PRODUCT_TYPES = new Set([
  "Top",
  "Bottom",
  "Skirt",
  "Dress",
  "Trouser",
  "Shorts",
  "Swimwear"
]);

/**
 * Title-only string (`titleLower` is usually all variant titles joined).
 * Swim rules first, then general apparel. Conflicts: title wins (never handle).
 */
function detectProductType(title) {
  const t = String(title || "").toLowerCase();

  // 🔥 ALWAYS FIRST — most specific
  if (t.includes("bikini bottoms") || t.includes("bikini bottom")) {
    return "Bottom";
  }

  // 🔥 THEN tops
  if (t.includes("bikini top")) {
    return "Top";
  }

  // 🔥 fallback (ONLY if not bottom)
  if (t.includes("bikini") && !t.includes("bottom")) {
    return "Top";
  }

  if (t.includes("swimsuit")) {
    return "Swimwear";
  }
  if (t.includes("sarong")) {
    return "Skirt";
  }

  if (t.includes("skirt")) return "Skirt";
  if (t.includes("short")) return "Shorts";
  if (
    t.includes("trouser") ||
    t.includes("pant") ||
    t.includes("pants") ||
    t.includes("capri")
  ) {
    return "Trouser";
  }

  if (
    t.includes("corset") ||
    t.includes("top") ||
    t.includes("crop") ||
    t.includes("cardigan") ||
    t.includes("bodysuit")
  ) {
    return "Top";
  }

  if (t.includes("dress") || t.includes("mini") || t.includes("maxi")) {
    return "Dress";
  }

  return "";
}

/** Map Shopify product_type string toward a broad type (never Swimwear→Top). */
function coerceRawToBroadType(normalisedRaw) {
  const x = String(normalisedRaw || "").trim().toLowerCase();
  if (!x) return "";
  if (x.includes("swimsuit") || x.includes("swimwear")) return "Swimwear";
  if (x.includes("bikini") && (x.includes("bottom") || x.includes("brief"))) {
    return "Bottom";
  }
  if (x.includes("dress")) return "Dress";
  if (x.includes("skirt")) return "Skirt";
  if (x.includes("short")) return "Shorts";
  if (x.includes("pant") || x.includes("trouser")) return "Trouser";
  if (
    x.includes("top") ||
    x.includes("shirt") ||
    x.includes("blouse") ||
    x.includes("corset") ||
    x.includes("bodysuit") ||
    x.includes("cardigan")
  ) {
    return "Top";
  }
  return "";
}

function clampBroadType(value) {
  const s = safeString(value);
  return BROAD_PRODUCT_TYPES.has(s) ? s : "";
}

function normalise(value) {
  const s = String(value ?? "").trim();
  if (!s) {
    return "";
  }
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Single-line HTML for CSV cells (json2csv escapes quotes). */
function cleanHtmlForCsv(html) {
  return String(html || "")
    .replace(/\r?\n|\r/g, " ")
    .trim();
}

const METAFIELD_COLUMNS = [
  "Metafield: custom.product_type_standard [single_line_text_field]",
  "Metafield: custom.product_type_detail [single_line_text_field]",
  "Metafield: custom.style [single_line_text_field]",
  "Metafield: custom.material [single_line_text_field]",
  "Metafield: custom.fit_type [single_line_text_field]",
  "Metafield: custom.colour_family [single_line_text_field]"
];

const SHOPIFY_FIELDS = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Type",
  "Product Category",
  "Published",
  "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value",
  "Variant SKU",
  "Variant Price",
  "Variant Inventory Tracker",
  "Variant Inventory Policy",
  "Variant Fulfillment Service",
  "Variant Inventory Qty",
  "Variant Grams",
  "Variant Image",
  "Image Src",
  ...METAFIELD_COLUMNS
];

/** Grams for Shopify CSV `Variant Grams` from active-products (`grams` / `weight` + `weight_unit`). */
function variantGramsForCsvImport(row) {
  const gramsRaw = row.grams ?? row["Variant Grams"];
  if (gramsRaw != null && gramsRaw !== "") {
    const n = Number(gramsRaw);
    if (Number.isFinite(n) && n >= 0) return String(Math.round(n));
  }

  const w = Number(row.weight ?? row["Variant Weight"] ?? "");
  const unit = safeString(
    row.weight_unit ?? row["Variant Weight Unit"] ?? ""
  ).toLowerCase();

  if (!Number.isFinite(w) || w < 0) return "0";

  let grams;
  switch (unit) {
    case "g":
    case "gram":
    case "grams":
      grams = w;
      break;
    case "kg":
    case "kilogram":
    case "kilograms":
      grams = w * 1000;
      break;
    case "lb":
    case "lbs":
    case "pound":
    case "pounds":
      grams = w * 453.59237;
      break;
    case "oz":
    case "ounce":
    case "ounces":
      grams = w * 28.349523125;
      break;
    default:
      return "0";
  }
  return String(Math.max(0, Math.round(grams)));
}

function firstDisplayTitleFromRows(rows) {
  for (const row of rows) {
    const t = safeString(
      String(row.product_title || row.Title || "")
        .split(/\s*-\s*/)
        .slice(0, -1)
        .join(" - ")
    );
    if (t) return t;
  }
  return "";
}

function firstVendorFromRows(rows) {
  for (const row of rows) {
    const v = safeString(row.product_vendor || row.Vendor || "");
    if (v) return v;
  }
  return "";
}

function firstRawProductTypeFromRows(rows) {
  for (const row of rows) {
    const v = safeString(row.product_type || row.Type || "");
    if (v) return v;
  }
  return "";
}

/**
 * Full gallery: every row’s `product_images_src` JSON (merged in row order), then
 * per-variant `image_src` / `variant_image`.
 */
function collectOrderedDedupedImages(rows) {
  const seen = new Set();
  const out = [];
  const tryAdd = url => {
    const img = safeString(url);
    if (!img || seen.has(img)) return;
    seen.add(img);
    out.push(img);
  };

  for (const r of rows) {
    const bulk = safeString(
      r.product_images_src || r["product_images_src"] || ""
    );
    if (!bulk) continue;
    try {
      const arr = JSON.parse(bulk);
      if (Array.isArray(arr)) {
        for (const u of arr) tryAdd(u);
      }
    } catch {
      /* ignore */
    }
  }

  for (const r of rows) {
    tryAdd(r.image_src || r["Image Src"] || "");
    tryAdd(r.variant_image || r["Variant Image"] || "");
  }
  return out;
}

function emptyShopifyProductRow(handle, overrides = {}) {
  /** @type {Record<string, string>} */
  const row = {};
  for (const field of SHOPIFY_FIELDS) {
    if (field === "Handle") {
      row[field] = safeString(handle);
    } else {
      row[field] =
        overrides[field] !== undefined ? String(overrides[field]) : "";
    }
  }
  return row;
}

function main() {
  if (process.argv.includes("--range") && RANGE_FROM_CLI == null) {
    console.error(
      "merge-products: invalid --range (use two 1-based inclusive indices, e.g. --range 1,3)"
    );
    process.exitCode = 1;
    return;
  }

  const products = [];

  fs.createReadStream(INPUT_FILE)
    .pipe(csv())
    .on("data", row => products.push(normalizeCsvRow(row)))
    .on("end", () => {
      const grouped = {};
      products.forEach(row => {
        const handle = String(row.product_handle || row.Handle || "").trim();
        if (!handle) return;
        if (!grouped[handle]) grouped[handle] = [];
        grouped[handle].push(row);
      });

      let output = [];
      const seen = new Set();
      const skuAllocator = createSkuAllocator();

      Object.keys(grouped).forEach(productHandle => {
        let group = grouped[productHandle];
        if (group.length === 0) return;

        // Stable sort by product_id
        group.sort((a, b) => String(a.product_id || "").localeCompare(String(b.product_id || ""), undefined, { numeric: true }));

        const displayTitle =
          firstDisplayTitleFromRows(group) ||
          safeString(productHandle.replace(/-/g, " "));

        const vendor = firstVendorFromRows(group) || "Koko Bay";
        const rawProductType = firstRawProductTypeFromRows(group);
        const titles = group.map(r =>
          String(r.product_title || r.Title || "").toLowerCase()
        );
        const handleLower = String(productHandle || "")
          .toLowerCase()
          .replace(/-/g, " ");
        /** Variant titles + handle words for taxonomy when titles are thin. */
        const titleLower = [titles.join(" "), handleLower].join(" ").trim();

        let productTypeStandard = clampBroadType(detectProductType(titleLower));
        if (!productTypeStandard) {
          productTypeStandard = clampBroadType(
            coerceRawToBroadType(normalise(rawProductType))
          );
        }

        const hasBottom = titleLower.includes("bikini bottom");
        const hasTop = titleLower.includes("bikini top");
        const hasSwimsuit = titleLower.includes("swimsuit");

        if (hasBottom) productTypeStandard = "Bottom";
        else if (hasTop) productTypeStandard = "Top";
        else if (hasSwimsuit) productTypeStandard = "Swimwear";

        const swimwearTag =
          /bikini|swimsuit|sarong|triangle|underwire|o-ring/.test(titleLower);

        // === HARD ENFORCEMENT RULES ===

        // If swimsuit → ALWAYS Swimwear
        if (swimwearTag && titleLower.includes("swimsuit")) {
          productTypeStandard = "Swimwear";
        }

        // If bikini bottoms → ALWAYS Bottom (else-if top so wrong title + correct slug cannot flip to Top)
        if (swimwearTag && titleLower.includes("bikini bottom")) {
          productTypeStandard = "Bottom";
        } else if (swimwearTag && titleLower.includes("bikini top")) {
          productTypeStandard = "Top";
        }

        const productCategory = getCategory(titleLower, productTypeStandard);

        const productTypeDetail = rawProductType;

        const type = normalise(
          productTypeStandard || rawProductType
        );

        const galleryImages = collectOrderedDedupedImages(group);

        let bodyHtmlForGroup = "";
        for (const r of group) {
          const raw = safeString(
            r.body_html || r["Body (HTML)"] || r["Body HTML"] || ""
          );
          if (raw) {
            bodyHtmlForGroup = raw;
            break;
          }
        }

        let isFirst = true;

        group.forEach(row => {
          const size = safeString(
            row.option1 || row["Option1 Value"] || row.option1_value || ""
          );
          const rowHandleRaw = safeString(
            row.product_handle || row.Handle || row.handle
          );
          const option2FromCsv = safeString(
            row.option2 || row["Option2 Value"] || row.option2_value || ""
          );
          let color = option2FromCsv
            ? formatVariantWords(option2FromCsv)
            : "Default";
          if (!option2FromCsv && rowHandleRaw.includes("-")) {
            const tail = rowHandleRaw.split("-").pop() || "";
            if (tail && color.toLowerCase() === "default") {
              color = formatVariantWords(tail);
            }
          }

          if (!size || color.toLowerCase() === "default") return;

          const key = `${productHandle}|${size}|${color}`;
          if (seen.has(key)) return;
          seen.add(key);

          const rowImageRaw = safeString(
            row.variant_image ||
              row["Variant Image"] ||
              row.image_src ||
              row["Image Src"] ||
              ""
          );
          const fallbackFromGallery =
            galleryImages.length > 0 ? galleryImages[0] : "";
          const variantImageForCsv = rowImageRaw || fallbackFromGallery;

          const price = safeString(row.price || row["Variant Price"] || "0") || "0";
          const qty = safeString(
            row.inventory_quantity || row["Variant Inventory Qty"] || "0"
          ) || "0";
          const rawSku = safeString(row.sku || row["Variant SKU"] || "");
          let sku;
          if (rawSku && isCanonicalSkuFormat(rawSku)) {
            sku = skuAllocator.ensureUniqueSku(rawSku);
          } else {
            const base = buildDeterministicSkuBase(
              displayTitle,
              titleLower,
              color,
              size
            );
            sku = skuAllocator.ensureUniqueSku(base);
          }

          const invTracker =
            safeString(
              row.inventory_management ||
                row["Variant Inventory Tracker"] ||
                row.inventoryManagement
            ) || "shopify";
          const invPolicy =
            safeString(
              row.inventory_policy ||
                row["Variant Inventory Policy"] ||
                row.inventoryPolicy
            ) || "deny";
          const fulfillment =
            safeString(
              row.fulfillment_service ||
                row["Variant Fulfillment Service"] ||
                row.fulfillmentService
            ) || "manual";

          const imageSrcOnRow = isFirst
            ? galleryImages.length > 0
              ? galleryImages[0]
              : variantImageForCsv
            : "";

          const shopifyRow = {
            Handle: safeString(productHandle),
            Title: isFirst ? safeString(displayTitle) : "",
            "Body (HTML)": isFirst ? cleanHtmlForCsv(bodyHtmlForGroup) : "",
            Vendor: isFirst ? safeString(vendor) : "",
            Type: isFirst ? type : "",
            "Product Category": isFirst ? productCategory : "",
            Published: "TRUE",
            "Option1 Name": "Size",
            "Option1 Value": size,
            "Option2 Name": "Color",
            "Option2 Value": color,
            "Variant SKU": sku,
            "Variant Price": price,
            "Variant Inventory Tracker": invTracker,
            "Variant Inventory Policy": invPolicy,
            "Variant Fulfillment Service": fulfillment,
            "Variant Inventory Qty": qty,
            "Variant Grams": variantGramsForCsvImport(row),
            "Variant Image": variantImageForCsv,
            "Image Src": imageSrcOnRow,
            "Metafield: custom.product_type_standard [single_line_text_field]":
              productTypeStandard ||
              coerceRawToBroadType(normalise(rawProductType)) ||
              "",
            "Metafield: custom.product_type_detail [single_line_text_field]":
              productTypeDetail,
            "Metafield: custom.style [single_line_text_field]": "",
            "Metafield: custom.material [single_line_text_field]": "",
            "Metafield: custom.fit_type [single_line_text_field]": "",
            "Metafield: custom.colour_family [single_line_text_field]": ""
          };

          output.push(shopifyRow);
          isFirst = false;
        });

        for (let gi = 1; gi < galleryImages.length; gi++) {
          output.push(
            emptyShopifyProductRow(productHandle, {
              "Image Src": galleryImages[gi]
            })
          );
        }

      });

      // === STRICT FINAL BLANKING PASS ===
      const byHandle = {};

      output.forEach(row => {
        if (!byHandle[row.Handle]) byHandle[row.Handle] = [];
        byHandle[row.Handle].push(row);
      });

      output = [];

      Object.values(byHandle).forEach(group => {
        group.forEach((row, index) => {
          const hasVariant =
            safeString(row["Option1 Value"]) ||
            safeString(row["Variant SKU"]);
          const isGalleryOnlyRow =
            index > 0 &&
            !hasVariant &&
            safeString(row["Image Src"]);

          if (index === 0) {
            row.Published = "TRUE";
          } else {
            row.Title = "";
            row["Body (HTML)"] = "";
            row.Vendor = "";
            row.Type = "";
            row["Product Category"] = "";
            row.Published = "";
            if (!isGalleryOnlyRow) {
              row["Image Src"] = "";
            }
          }
          output.push(row);
        });
      });

      const outDir = path.dirname(OUTPUT_FILE);
      const outBase = path.basename(OUTPUT_FILE, path.extname(OUTPUT_FILE));

      const handlesSortedUnique = [
        ...new Set(output.map(r => r.Handle).filter(Boolean))
      ].sort(compareHandlesForRange);

      /** Filename suffix like `1-3` for `.range-1-3.csv`; null if full export or legacy chunk. */
      let rangeFileSuffix = null;

      if (RANGE_FROM_CLI != null) {
        const total = handlesSortedUnique.length;
        const startPos = RANGE_FROM_CLI.start;
        let endPos = RANGE_FROM_CLI.end;
        if (startPos > total) {
          console.error(
            `merge-products: --range start ${startPos} is past ${total} product(s) (alphabetical by handle).`
          );
          process.exitCode = 1;
          return;
        }
        if (endPos > total) {
          console.warn(
            `merge-products: --range end ${RANGE_FROM_CLI.end} clamped to ${total} (last index).`
          );
          endPos = total;
        }
        const handleSet = new Set(
          handlesSortedUnique.slice(startPos - 1, endPos)
        );
        rangeFileSuffix = `${startPos}-${endPos}`;
        output = output.filter(row => handleSet.has(row.Handle));
      } else if (CHUNK_NUMBER != null) {
        const start = (CHUNK_NUMBER - 1) * HANDLE_CHUNK_SIZE;
        const handleSet = new Set(
          handlesSortedUnique.slice(start, start + HANDLE_CHUNK_SIZE)
        );
        output = output.filter(row => handleSet.has(row.Handle));
      }

      const parser = new Parser({
        fields: SHOPIFY_FIELDS,
        withBOM: false,
        delimiter: ",",
        eol: "\n",
        header: true,
        formatters: {
          string: csvFormatters.string({ quote: '"', escapedQuote: '""' })
        }
      });
      const csvOutput = parser.parse(output);

      const productCsvPath =
        rangeFileSuffix != null
          ? path.join(outDir, `${outBase}.range-${rangeFileSuffix}.csv`)
          : CHUNK_NUMBER != null
            ? path.join(outDir, `${outBase}.chunk-${CHUNK_NUMBER}.csv`)
            : OUTPUT_FILE;

      fs.writeFileSync(productCsvPath, csvOutput, { encoding: "utf8" });
    });
}

main();