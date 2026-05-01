/**
 * Strip BOM / trim header keys for `csv-parser` rows (Shopify / list-active CSVs).
 * Shared by merge-products, generate-color-update-csv, and similar scripts.
 *
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>}
 */
function normalizeCsvRow(row) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const key = String(k).replace(/^\ufeff/, "").trim();
    out[key] = v;
  }
  return out;
}

module.exports = { normalizeCsvRow };
