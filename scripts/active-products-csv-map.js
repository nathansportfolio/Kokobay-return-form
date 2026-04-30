/**
 * Shared: backup-shaped flat rows → Shopify import column titles (no merge / handle rewrite).
 * Used by `list-active-shopify-products.ts` CSV export and `active-products-shopify-headers.js`.
 */

const SHOPIFY_CSV_FIELDS = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Type",
  "Product Category",
  "Tags",
  "Collection",
  "Published",
  "Option1 Name",
  "Option1 Value",
  "Option2 Name",
  "Option2 Value",
  "Variant SKU",
  "Variant ID",
  "Variant Price",
  "Variant Inventory Tracker",
  "Variant Inventory Policy",
  "Variant Fulfillment Service",
  "Variant Inventory Qty",
  "Variant Grams",
  "Variant Image",
  "Image Src",
  "Metafield: custom.product_type_standard [single_line_text_field]",
  "Metafield: custom.product_type_detail [single_line_text_field]",
  "Metafield: custom.style [single_line_text_field]",
  "Metafield: custom.material [single_line_text_field]",
  "Metafield: custom.fit_type [single_line_text_field]",
  "Metafield: custom.colour_family [single_line_text_field]",
  "product_images_src"
];

function get(row, ...keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).length) return String(row[k]);
  }
  return "";
}

function optionNamesFromProduct(optionsJsonRaw) {
  const raw = String(optionsJsonRaw ?? "").trim();
  if (!raw) return ["", ""];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return ["", ""];
    const sorted = [...arr].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return [
      sorted[0]?.name != null ? String(sorted[0].name) : "",
      sorted[1]?.name != null ? String(sorted[1].name) : ""
    ];
  } catch {
    return ["", ""];
  }
}

function publishedCell(row) {
  const p = get(row, "product_published_at", "Published");
  if (!p.trim()) return "FALSE";
  if (/^false$|^no$/i.test(p.trim())) return "FALSE";
  return "TRUE";
}

function safeString(value) {
  return String(value ?? "").trim();
}

function variantGramsFromRow(row) {
  const gramsRaw = row.grams ?? row["Variant Grams"];
  if (gramsRaw != null && gramsRaw !== "") {
    const n = Number(gramsRaw);
    if (Number.isFinite(n) && n >= 0) return String(Math.round(n));
  }
  const w = Number(row.weight ?? row["Variant Weight"] ?? "");
  const unit = safeString(
    row.weight_unit ?? row["Variant Weight Unit"] ?? ""
  ).toLowerCase();
  if (!Number.isFinite(w) || w < 0) return "";
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
      return "";
  }
  return String(Math.max(0, Math.round(grams)));
}

/**
 * Map one backup-shaped row (REST / old CSV column names) to Shopify-style columns.
 * @param {Record<string, unknown>} row
 */
function rowToShopifyCsv(row) {
  const [n1, n2] = optionNamesFromProduct(row.options_json);
  const variantImage = Object.prototype.hasOwnProperty.call(row, "variant_image")
    ? String(row.variant_image ?? "")
    : get(row, "image_src", "Image Src");
  const imageSrcCell = Object.prototype.hasOwnProperty.call(row, "image_src_cell")
    ? String(row.image_src_cell ?? "")
    : get(row, "image_src", "Image Src");

  return {
    Handle: get(row, "product_handle", "Handle"),
    Title: get(row, "product_title", "Title"),
    "Body (HTML)": get(row, "body_html", "Body (HTML)", "Body HTML"),
    Vendor: get(row, "product_vendor", "Vendor"),
    Type: get(row, "product_type", "Type"),
    "Product Category": get(row, "Product Category", "product_category"),
    Tags: get(row, "product_tags", "Tags"),
    Collection: get(row, "product_collections", "Collection"),
    Published: publishedCell(row),
    "Option1 Name": n1,
    "Option1 Value": get(row, "option1", "Option1 Value"),
    "Option2 Name": n2,
    "Option2 Value": get(row, "option2", "Option2 Value"),
    "Variant SKU": get(row, "sku", "Variant SKU"),
    "Variant ID": get(row, "variant_id", "Variant ID"),
    "Variant Price": get(row, "price", "Variant Price"),
    "Variant Inventory Tracker": get(
      row,
      "inventory_management",
      "Variant Inventory Tracker"
    ),
    "Variant Inventory Policy": get(
      row,
      "inventory_policy",
      "Variant Inventory Policy"
    ),
    "Variant Fulfillment Service": get(
      row,
      "fulfillment_service",
      "Variant Fulfillment Service"
    ),
    "Variant Inventory Qty": get(
      row,
      "inventory_quantity",
      "Variant Inventory Qty"
    ),
    "Variant Grams": variantGramsFromRow(row),
    "Variant Image": variantImage,
    "Image Src": imageSrcCell,
    "Metafield: custom.product_type_standard [single_line_text_field]": "",
    "Metafield: custom.product_type_detail [single_line_text_field]": "",
    "Metafield: custom.style [single_line_text_field]": "",
    "Metafield: custom.material [single_line_text_field]": "",
    "Metafield: custom.fit_type [single_line_text_field]": "",
    "Metafield: custom.colour_family [single_line_text_field]": "",
    product_images_src: get(row, "product_images_src")
  };
}

module.exports = {
  SHOPIFY_CSV_FIELDS,
  rowToShopifyCsv
};
