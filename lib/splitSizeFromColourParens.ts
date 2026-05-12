import { isLikelySizeOnlyToken } from "@/lib/shopifyProductCatalog";

/**
 * When Shopify or Mongo stores a swatch as `Mocha Melt (6)`, treat the
 * parenthetical as **size** and keep the print name for the colour line.
 */
export function splitSizeFromColourParens(
  raw: string | undefined,
): { colour: string; sizeFromParens?: string } {
  const s = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) {
    return { colour: "" };
  }
  const m = /^(.*)\(\s*([^)]+)\s*\)\s*$/u.exec(s);
  if (!m) {
    return { colour: s };
  }
  const inner = m[2]!.trim();
  if (!inner) {
    return { colour: s };
  }
  if (isLikelySizeOnlyToken(inner) || /^\d{1,2}$/u.test(inner)) {
    const base = m[1]!.trim();
    if (base) {
      return { colour: base, sizeFromParens: inner };
    }
  }
  return { colour: s };
}

/**
 * When a colour field (Mongo or parsed title tail) is a single `A / B` token
 * where exactly one side is a recognizable **size**, treat the other side as
 * the swatch name and return the size for pick UI. Covers Shopify
 * `Size / Colour` (`8 / Black`) as well as `Colour / Size` (`Apricot / 10`).
 */
export function splitSizeAndColourFromSlashToken(raw: string | undefined): {
  colourOnly: string;
  sizeIfSplit?: string;
} | null {
  const s = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s || !s.includes("/")) {
    return null;
  }
  const segs = s.split(/\s*\/\s*/u).map((x) => x.trim()).filter(Boolean);
  if (segs.length !== 2) {
    return null;
  }
  const a = segs[0]!;
  const b = segs[1]!;
  const aSz = isLikelySizeOnlyToken(a);
  const bSz = isLikelySizeOnlyToken(b);
  if (aSz && !bSz) {
    return { colourOnly: b, sizeIfSplit: a };
  }
  if (!aSz && bSz) {
    return { colourOnly: a, sizeIfSplit: b };
  }
  return null;
}
