/**
 * Builds a compact SKU from a line display title:
 *   [NAME(4)]-[COLOR(4)]-[SIZE]
 *
 * Name and colour segments: first two letters per word; if the segment is
 * still shorter than 4, continue with more letters from the first word, then
 * the second, until 4.
 *
 * Example: "The cowl maxi - blue & purple floral – 4" → STBI-BLPU-4
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

function isStopWord(w: string): boolean {
  return ["the", "a", "an"].includes(w.toLowerCase());
}

/**
 * 4 characters from `raw`: 2 from each word in order, then (if &lt; 4) more
 * letters from the first word, then the second, etc. Pads to 4 with X only
 * if still short.
 */
function firstTwoPerWordPadded4(
  raw: string,
  options?: { stripLeadArticle?: boolean },
): string {
  let s = raw.trim();
  if (options?.stripLeadArticle) {
    s = s.replace(/^(the|a|an)\s+/i, "").trim();
  }
  const words = s
    .split(/\s+/)
    .map((w) => lettersOnly(w))
    .filter((w) => w.length > 0);
  const significant = words.filter((w) => !isStopWord(w));
  const toUse = significant.length > 0 ? significant : words;
  if (toUse.length === 0) {
    return "ITEM";
  }

  let out = "";
  for (const w of toUse) {
    if (out.length >= 4) break;
    const u = w.toUpperCase();
    if (!u) continue;
    const need = 4 - out.length;
    const pair = u.length >= 2 ? u.slice(0, 2) : (u + "X").toUpperCase();
    out += pair.slice(0, need < 2 ? need : 2);
  }
  if (out.length < 4) {
    for (const w of toUse) {
      if (out.length >= 4) break;
      const u = w.toUpperCase();
      for (let i = 2; i < u.length && out.length < 4; i++) {
        out += u[i]!;
      }
    }
  }
  if (out.length < 4) {
    return out.toUpperCase().padEnd(4, "X").slice(0, 4);
  }
  return out.slice(0, 4);
}

function twoOfWord(word: string): string {
  const a = lettersOnly(word);
  if (a.length >= 2) return a.slice(0, 2).toUpperCase();
  if (a.length === 1) return (a + "X").toUpperCase();
  return "XX";
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
  return firstTwoPerWordPadded4(firstSegment, { stripLeadArticle: true });
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
  return firstTwoPerWordPadded4(firstWord(s), { stripLeadArticle: false });
}

function normalizeSize(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase() || "1";
}

/**
 * Returns a SKU like `STBI-SAGE-10` or (two-tone colour) `COMA-BLPU-4`, or
 * `null` if the title is too empty to format (caller should use
 * `V{variant_id}`).
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
      // Titles like "The starfish bikini top- sage – 10" only produce two
      // top-level parts (tight "top- sage" is not a spaced em/en dash);
      // split the name segment on inner dashes so the colour (e.g. sage) is not lost.
      const subParts = a
        .split(/[-–—]/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (subParts.length >= 2) {
        const nameSeg = subParts.slice(0, -1).join(" - ");
        const colorSeg = subParts[subParts.length - 1] ?? "";
        if (nameSeg && colorSeg) {
          return `${namePart4(nameSeg)}-${colorPart4(colorSeg)}-${normalizeSize(
            b,
          )}`;
        }
      }
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
