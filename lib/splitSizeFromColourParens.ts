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
