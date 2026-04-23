/**
 * Builds a compact SKU from a line display title:
 *   [NAME(4)]-[COLOR(2+2)]-[SIZE]
 *
 * Example: "The cowl maxi - blue & purple floral – 4" → COWL-BLPU-4
 * Splits on spaced em/en/ASCII hyphens, then: name, optional multi-part colour, size.
 */

const SPACED_DASH = /\s+[–—-]\s+/g;

function lettersOnly(s: string): string {
  return s.replace(/[^a-z0-9]/gi, "");
}

function firstWord(s: string): string {
  const m = s.trim().match(/^([^\s&/]+)/);
  return m ? m[1]! : s.trim();
}

function twoOfWord(word: string): string {
  const a = lettersOnly(word);
  if (a.length >= 2) return a.slice(0, 2).toUpperCase();
  if (a.length === 1) return (a + "X").toUpperCase();
  return "XX";
}

/** 2+2 from a single colour word, e.g. "lemon" → LEMO, "strawberry" → STRA */
function twoPlusTwoInWord(word: string): string {
  const a = lettersOnly(word).toUpperCase();
  if (a.length >= 4) {
    return a.slice(0, 2) + a.slice(2, 4);
  }
  if (a.length > 0) {
    return a.padEnd(4, "X").slice(0, 4);
  }
  return "XXXX";
}

function isLikelySizeSegment(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/^(\d{1,2})([./](\d{1,2}))?$/i.test(t)) {
    return true;
  }
  if (/^(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|OS|ONE|NS|SM|MD|LG|REG)$/i.test(t)) {
    return true;
  }
  return false;
}

function namePart4(firstSegment: string): string {
  const stripped = firstSegment
    .replace(/^(the|a|an)\s+/i, "")
    .trim();
  const words = stripped.split(/\s+/).filter(Boolean);
  for (const w of words) {
    const a = lettersOnly(w);
    if (a.length >= 4) {
      return a.slice(0, 4).toUpperCase();
    }
  }
  for (const w of words) {
    const a = lettersOnly(w);
    if (a.length > 0) {
      return a.toUpperCase().padEnd(4, "X").slice(0, 4);
    }
  }
  return "ITEM";
}

function colorPart4(colorSegment: string): string {
  const s = colorSegment.trim();
  if (!s) {
    return "XXXX";
  }
  if (s.includes("&") || /\band\b/i.test(s)) {
    const byAmp = s.split(/\s*&\s*/i);
    if (byAmp.length >= 2) {
      const a = firstWord(byAmp[0]!);
      const b = firstWord(byAmp.slice(1).join(" ") ?? "");
      return (twoOfWord(a) + twoOfWord(b)).slice(0, 4);
    }
    const byAnd = s.split(/\s+and\s+/i);
    if (byAnd.length >= 2) {
      return (
        twoOfWord(firstWord(byAnd[0]!)) + twoOfWord(firstWord(byAnd[1]!))
      ).slice(0, 4);
    }
  }
  const w = firstWord(s);
  return twoPlusTwoInWord(w);
}

function normalizeSize(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase() || "1";
}

/**
 * Returns a SKU like `COWL-BLPU-4`, or `null` if the title is too empty to
 * format (caller should use `V{variant_id}`).
 */
export function deriveKokobayStyleSkuFromTitle(title: string): string | null {
  const t = String(title).trim();
  if (t.length < 3) {
    return null;
  }
  const parts = t.split(SPACED_DASH).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  if (parts.length === 2) {
    const [a, b] = parts;
    if (!a || !b) return null;
    if (isLikelySizeSegment(b)) {
      return `${namePart4(a)}-XXXX-${normalizeSize(b)}`;
    }
    return `${namePart4(a)}-${colorPart4(b)}-OS`;
  }
  const size = parts[parts.length - 1] ?? "";
  const nameSeg = parts[0] ?? "";
  const colorSeg = parts.slice(1, -1).join(" - ");
  if (!nameSeg || !colorSeg) {
    return null;
  }
  return `${namePart4(nameSeg)}-${colorPart4(colorSeg)}-${normalizeSize(size)}`;
}
