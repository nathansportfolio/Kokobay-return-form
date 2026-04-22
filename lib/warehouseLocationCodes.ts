import type { CSSProperties } from "react";
import { parseKokobayLocation } from "@/lib/kokobayLocationFormat";

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

/** Aisle letter from a full code like `B-04-C3` (first segment). */
export function kokobayAisleLetterFromLocation(loc: string): string {
  const p = parseKokobayLocation(loc);
  if (p) return p.aisle;
  const first = loc.split("-")[0]?.trim();
  if (first && /^[A-Za-z]$/i.test(first)) return first.toUpperCase();
  return "?";
}

export function kokobayAisleIndexForStyle(loc: string): number {
  const letter = kokobayAisleLetterFromLocation(loc);
  if (letter === "?") return 0;
  return Math.min(25, Math.max(0, letter.charCodeAt(0) - 65));
}

export function locationBadgeStyleFromLocation(loc: string): CSSProperties {
  return binBadgeStyleFromLetterIndex(kokobayAisleIndexForStyle(loc));
}

const NEUTRAL_BADGE =
  "inline-flex min-w-[1.5rem] items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-sm font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-200";

const SEP = "text-zinc-400 dark:text-zinc-500";

/**
 * Distinct **shelf** colours (A–F); **bin 1–3** steps lighter → deeper in that family.
 * A=green, B=blue, C=yellow, D=orange, E=red, F=purple.
 */
const SHELF_HUE: readonly number[] = [
  145, 218, 52, 32, 4, 278, // A B C D E F
];

export function shelfBinBadgeStyle(
  shelfLetter: string,
  bin: number,
): CSSProperties {
  const shelfIdx = Math.min(
    5,
    Math.max(0, shelfLetter.toUpperCase().charCodeAt(0) - 65),
  );
  const b = Math.min(3, Math.max(1, bin));
  const h = SHELF_HUE[shelfIdx] ?? 145;
  const t = (b - 1) / 2; // 0, 0.5, 1  — bin 1 lightest, bin 3 most intense/dark
  const s = 48 + t * 36; // 48% → 84%
  const l = 68 - t * 40; // 68% → 28% (keeps each hue recognisable)
  const isDark = l < 42;
  return {
    backgroundColor: `hsl(${h} ${Math.round(s)}% ${Math.round(l)}%)`,
    color: isDark
      ? "hsl(0 0% 99%)"
      : `hsl(${h} 35% ${h >= 40 && h <= 58 ? 12 : 18}%)`, // better contrast on yellows
    textShadow: isDark ? "0 1px 1px rgba(0,0,0,0.35)" : undefined,
    boxShadow: `inset 0 0 0 1px hsl(${h} ${Math.round(s * 0.88)}% ${
      isDark ? 16 : 72
    }%)`,
  };
}

export { NEUTRAL_BADGE, SEP };
