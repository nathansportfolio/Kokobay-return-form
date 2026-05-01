/**
 * SKU helpers shared by `merge-products.js` and `missing-variant-skus.ts`.
 * Keep in sync with merge CSV rules (canonical format, deterministic base, uniqueness).
 */

"use strict";

function formatVariantWords(text) {
  let v = String(text ?? "").trim();
  if (!v) v = "Default";
  return v
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function safeString(value) {
  return String(value ?? "").trim();
}

/** Stop words skipped when deriving SKU product code from title. */
const SKU_TITLE_STOP_WORDS = new Set(["the", "and", "&", "set", "lace"]);

/**
 * Title tokens removed from product_code — same meanings as TYPE (no duplicate in SKU prefix).
 * Covers corset/top/dress/skirt/trousers/pants/shorts/bikini lexicon.
 */
const SKU_TYPE_MEANING_STOP_WORDS = new Set([
  "corset",
  "top",
  "dress",
  "dresses",
  "skirt",
  "skirts",
  "trouser",
  "trousers",
  "pant",
  "pants",
  "short",
  "shorts",
  "bikini"
]);

const SKU_COLOUR_TO_CODE = {
  black: "BLK",
  white: "WHT",
  red: "RED",
  blue: "BLU",
  green: "GRN",
  pink: "PNK",
  beige: "BEG",
  brown: "BRN",
  grey: "GRY",
  gray: "GRY",
  nude: "NUD"
};

const SKU_TYPE_CODES = new Set([
  "CRST",
  "TOP",
  "DRS",
  "SKT",
  "TRS",
  "SRT",
  "BIK",
  "GEN"
]);

/**
 * Canonical merged SKU: `{product_code}-{TYPE}-{COLOUR}-{SIZE}` with optional trailing `-N`
 * for duplicate resolution. `product_code` is one or more segments (e.g. AMARA or AMARA-BEACH), so we parse
 * from the right and only treat a trailing numeric segment as `-N` when the body alone is valid.
 */
function parseSkuBodyParts(parts) {
  if (parts.length < 4) return null;
  const n = parts.length;
  const size = parts[n - 1];
  const colour = parts[n - 2];
  const type = parts[n - 3];
  if (!SKU_TYPE_CODES.has(type)) return null;
  if (!/^[A-Z]{3}$/.test(colour)) return null;
  if (!size || !/^[A-Z0-9]+$/.test(size)) return null;
  const productParts = parts.slice(0, n - 3);
  if (productParts.length < 1) return null;
  for (const p of productParts) {
    if (!/^[A-Z0-9]+$/.test(p)) return null;
  }
  return true;
}

function isCanonicalSkuFormat(s) {
  const upper = String(s || "").trim().toUpperCase();
  if (!upper) return false;
  const parts = upper.split("-");
  if (parseSkuBodyParts(parts) != null) return true;
  if (parts.length >= 5 && /^\d+$/.test(parts[parts.length - 1])) {
    return parseSkuBodyParts(parts.slice(0, -1)) != null;
  }
  return false;
}

/**
 * First two meaningful title words after dropping stop words and TYPE-meaning words
 * (uppercase, joined by `-`). Single segment if only one remains — avoids AMARA-TROUSER-TRS-….
 */
function skuProductCodeFromTitle(displayTitle) {
  const raw = String(displayTitle || "").trim();
  const tokens = raw
    .toLowerCase()
    .replace(/&/g, " ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const meaningful = [];
  for (const w of tokens) {
    if (SKU_TITLE_STOP_WORDS.has(w)) continue;
    if (SKU_TYPE_MEANING_STOP_WORDS.has(w)) continue;
    const alnum = w.replace(/[^a-z0-9]/gi, "");
    if (!alnum) continue;
    meaningful.push(alnum.toUpperCase());
    if (meaningful.length >= 2) break;
  }
  if (meaningful.length === 0) return "ITEM";
  return meaningful.join("-");
}

function skuTypeCodeFromTitle(titleLower) {
  const t = String(titleLower || "").toLowerCase();
  if (t.includes("corset")) return "CRST";
  if (t.includes("bikini")) return "BIK";
  if (t.includes("dress")) return "DRS";
  if (t.includes("skirt")) return "SKT";
  if (t.includes("short")) return "SRT";
  if (/\btrousers?\b/.test(t) || /\bpants?\b/.test(t)) return "TRS";
  if (t.includes("top")) return "TOP";
  return "GEN";
}

function skuColourCode(colourDisplay) {
  const key = String(colourDisplay || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const direct = SKU_COLOUR_TO_CODE[key];
  if (direct) return direct;
  const keysByLen = Object.keys(SKU_COLOUR_TO_CODE).sort((a, b) => b.length - a.length);
  for (const k of keysByLen) {
    if (key.includes(k)) return SKU_COLOUR_TO_CODE[k];
  }
  const letters = key.replace(/[^a-z]/gi, "").toUpperCase();
  const three = letters.slice(0, 3);
  if (three.length >= 3) return three;
  return three.padEnd(3, "X");
}

function skuSizePart(option1Value) {
  let s = String(option1Value || "")
    .trim()
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .trim();
  s = s.replace(/\s+/g, "");
  const up = s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return up || "NA";
}

function buildDeterministicSkuBase(displayTitle, titleLower, colourDisplay, sizeRaw) {
  const productCode = skuProductCodeFromTitle(displayTitle);
  const typeCode = skuTypeCodeFromTitle(titleLower);
  const colourCode = skuColourCode(colourDisplay);
  const sizeCode = skuSizePart(sizeRaw);
  return `${productCode}-${typeCode}-${colourCode}-${sizeCode}`;
}

function createSkuAllocator() {
  const allocatedSkuKeys = new Set();
  return {
    ensureUniqueSku(desired) {
      const base = String(desired || "").trim();
      const upperBase = base.toUpperCase();
      if (!allocatedSkuKeys.has(upperBase)) {
        allocatedSkuKeys.add(upperBase);
        return base;
      }
      let n = 1;
      let candidate;
      do {
        candidate = `${base}-${n}`;
        n += 1;
      } while (allocatedSkuKeys.has(candidate.toUpperCase()));
      allocatedSkuKeys.add(candidate.toUpperCase());
      return candidate;
    }
  };
}

/**
 * For `--range` / chunk ordering only: duplicate products often have `copy-of-` / `copy-` handles,
 * which sort before `the-…` in raw string order. Strip those prefixes so index N matches “logical” slug order.
 * Does not change emitted `Handle` values.
 */
function sortKeyForRange(handle) {
  const s = safeString(handle).toLowerCase();
  if (s.startsWith("copy-of-")) return s.slice("copy-of-".length);
  if (s.startsWith("copy-")) return s.slice("copy-".length);
  return s;
}

function compareHandlesForRange(a, b) {
  const c = sortKeyForRange(a).localeCompare(sortKeyForRange(b), undefined, {
    sensitivity: "base"
  });
  if (c !== 0) return c;
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}

module.exports = {
  safeString,
  formatVariantWords,
  isCanonicalSkuFormat,
  buildDeterministicSkuBase,
  createSkuAllocator,
  compareHandlesForRange
};
