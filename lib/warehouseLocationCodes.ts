import type { CSSProperties } from "react";

/** Parse "Row 2" → 2; unknown → high sentinel so sort stays stable. */
export function parseRowNumber(row: string): number {
  const m = /Row\s*(\d+)/i.exec(row.trim());
  if (m) return parseInt(m[1], 10);
  return 9999;
}

/** Parse "Bin A2c" → ["A", 2, "c"] style tuple for sort / heat. */
export function parseBinSortTuple(bin: string): [string, number, string] {
  const m = /Bin\s*([A-Za-z]+)(\d+)([a-z]?)/i.exec(bin.trim());
  if (!m) return ["ZZ", 999, "z"];
  return [
    m[1].toUpperCase(),
    parseInt(m[2], 10),
    (m[3] || "").toLowerCase(),
  ];
}

/** First aisle letter after `Bin` (e.g. `Bin A2c` → 0). Unknown → 0. */
export function binAisleLetterIndex(bin: string): number {
  const m = /Bin\s*([A-Za-z])/i.exec(bin.trim());
  if (!m) return 0;
  const code = m[1].toUpperCase().charCodeAt(0);
  if (code < "A".charCodeAt(0) || code > "Z".charCodeAt(0)) return 0;
  return code - "A".charCodeAt(0);
}

export function binAisleLetter(bin: string): string {
  const m = /Bin\s*([A-Za-z])/i.exec(bin.trim());
  return m ? m[1].toUpperCase() : "?";
}

/**
 * Strong, distinct hues per letter — A green, B light green, C blue, … through
 * the spectrum toward Z red (not a dull linear fade).
 */
const BIN_LETTER_HUES: readonly number[] = [
  148, 118, 222, 202, 258, 288, 312, 338, 4, 28, 52, 78, 98, 128, 168, 188, 208,
  232, 268, 292, 318, 332, 350, 12, 32, 2,
];

/**
 * Vivid badge: high saturation, mid luminance, white label text.
 */
export function binBadgeStyleFromLetterIndex(letterIndex: number): CSSProperties {
  const idx = Math.min(25, Math.max(0, letterIndex));
  const hue = BIN_LETTER_HUES[idx] ?? 148;
  const sat = 88 + (idx % 3) * 3;
  const bgL = 44 + (idx % 4) * 2;
  const borderL = Math.max(22, bgL - 18);
  return {
    backgroundColor: `hsl(${hue} ${sat}% ${bgL}%)`,
    color: "hsl(0 0% 99%)",
    textShadow: "0 1px 1px hsl(0 0% 0% / 0.35)",
    boxShadow: `inset 0 0 0 1px hsl(${hue} 90% ${borderL}%)`,
  };
}

export function binBadgeStyleFromBin(bin: string): CSSProperties {
  return binBadgeStyleFromLetterIndex(binAisleLetterIndex(bin));
}
