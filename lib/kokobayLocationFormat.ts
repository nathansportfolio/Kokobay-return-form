/**
 * Kokobay address codes look like: `B-04-C3`
 * - Aisle: single letter **A–U** (Aisle U = current max).
 * - Bay: two digits, e.g. `04` (use 01–99 in seed; leading zero for display).
 * - Shelf: letter **A–F** = shelf height (A = lowest / 1st, F = 6th / top). So **C = 3rd shelf** (“Shelf 3”).
 * - Bin: digit **1–3** only in current seed.
 *
 * Example: `B-04-C3` = Aisle **B**, Bay **04**, Shelf **C** (3rd level), Bin **3**.
 */

const AISLE_RE = /^[A-U]$/i;
const SHELF_RE = /^[A-F]$/i;

export type ParsedKokobayLocation = {
  raw: string;
  aisle: string;
  /** Integer bay number, e.g. 4 for "04" */
  bay: number;
  /** A–F */
  shelfLetter: string;
  /** 1 = A, … 6 = F (shelf “number” in plain language) */
  shelfLevel: number;
  /** 1–3 in current constraints */
  bin: number;
};

const LINE_RE = /^([A-Ua-u])-(\d{1,2})-([A-Fa-f])([1-3])$/;

export function parseKokobayLocation(
  s: string,
): ParsedKokobayLocation | null {
  const t = s.trim();
  const m = LINE_RE.exec(t);
  if (!m) return null;
  const aisle = m[1].toUpperCase();
  const bay = parseInt(m[2], 10);
  const shelfLetter = m[3].toUpperCase();
  const bin = parseInt(m[4], 10);
  if (!AISLE_RE.test(aisle) || !/^\d{1,2}$/.test(m[2]) || bay < 1 || bay > 99) {
    return null;
  }
  if (!SHELF_RE.test(shelfLetter)) return null;
  const shelfLevel = shelfLetter.charCodeAt(0) - "A".charCodeAt(0) + 1;
  return {
    raw: t,
    aisle,
    bay,
    shelfLetter,
    shelfLevel,
    bin,
  };
}

/**
 * Human-readable title, aligned with: Aisle, Bay, Shelf n (letter), Bin.
 * e.g. Aisle B, Bay 04, Shelf 3 (C), Bin 3
 */
export function kokobayLocationTitle(s: string): string {
  const p = parseKokobayLocation(s);
  if (!p) return s;
  const bayPadded = String(p.bay).padStart(2, "0");
  return `Aisle ${p.aisle}, Bay ${bayPadded}, Shelf ${p.shelfLevel} (${p.shelfLetter}), Bin ${p.bin}`;
}

/** Walk order: aisle (A..U) → bay → shelf (A..F, low to high) → bin → SKU. */
export function locationSortKey(loc: string): [number, number, number, number, string] {
  const p = parseKokobayLocation(loc);
  if (!p) return [999, 999, 9, 9, loc];
  const aisleI = p.aisle.charCodeAt(0) - "A".charCodeAt(0);
  const shelfI = p.shelfLetter.charCodeAt(0) - "A".charCodeAt(0);
  return [aisleI, p.bay, shelfI, p.bin, p.raw];
}

export function compareKokobayLocation(a: string, b: string): number {
  const ka = locationSortKey(a);
  const kb = locationSortKey(b);
  for (let i = 0; i < 4; i++) {
    if (ka[i] !== kb[i]) return ka[i]! < kb[i]! ? -1 : 1;
  }
  return ka[4].localeCompare(kb[4]);
}

const AISLES = "ABCDEFGHIJKLMNOPQRSTU" as const;
const SHELVES = "ABCDEF" as const;

/** Diverse but deterministic distribution for mock seed (1–3 bins, A–F shelves, A–U aisles). */
export function randomKokobayLocationForIndex(i: number): string {
  const aisle = AISLES[((i * 17) % 210) % 21]!;
  const bay = 1 + ((i * 11 + 3) % 20);
  const shelf = SHELVES[(i * 5 + 1) % 6]!;
  const bin = 1 + (i % 3);
  return `${aisle}-${String(bay).padStart(2, "0")}-${shelf}${bin}`;
}
