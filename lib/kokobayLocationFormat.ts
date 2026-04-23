/**
 * Kokobay address codes look like: `B-04-C3`
 * - Aisle: letters **A–Z**, then **AA**, **AB**, … (Excel-style rack codes).
 * - Bay: two digits, e.g. `04` (use 01–99 in seed; leading zero for display).
 * - Shelf: letter **A–F** = shelf height (A = lowest / 1st, F = 6th / top). So **C = 3rd shelf** (“Shelf 3”).
 * - Bin: digit **1–3** only in current seed.
 *
 * Example: `B-04-C3` = legacy (shelf C, slot 3). Warehouse bins / stock use
 * **three-segment** `A-13-F` = rack, bay, level only (no position).
 */

import { bayCountForRack, KOKO_RACKS, rackCodeToIndex } from "@/lib/warehouseRackLayout";

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
  /** Slot: legacy 1–3; `0` = rack/bay/level only (no slot / position). */
  bin: number;
};

/** Legacy mock / catalog: `B-04-C3` = aisle, bay, shelf+slot (1–3). */
const LINE_RE = /^([A-Za-z]+)-(\d{1,2})-([A-Fa-f])([1-3])$/;
/** Old 4-segment data (before position was dropped); still parsed for existing DB. */
const BIN_FOUR_PART_LEGACY_RE =
  /^([A-Za-z]+)-(\d{1,2})-([A-Fa-f])-([12])$/i;
/** Bins / stock: `A-13-F` or `AA-01-A` = rack, 2-digit bay, level A–F only. */
const RACK_BAY_LEVEL_RE = /^([A-Za-z]+)-(\d{1,2})-([A-Fa-f])$/;

export function parseKokobayLocation(
  s: string,
): ParsedKokobayLocation | null {
  const t = s.trim();
  const m1 = LINE_RE.exec(t);
  if (m1) {
    const aisle = m1[1]!.toUpperCase();
    const bay = parseInt(m1[2]!, 10);
    const shelfLetter = m1[3]!.toUpperCase();
    const bin = parseInt(m1[4]!, 10);
    if (rackCodeToIndex(aisle) < 1 || !/^\d{1,2}$/.test(m1[2]!) || bay < 1 || bay > 99) {
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
  const m2 = BIN_FOUR_PART_LEGACY_RE.exec(t);
  if (m2) {
    const aisle = m2[1]!.toUpperCase();
    const bay = parseInt(m2[2]!, 10);
    const shelfLetter = m2[3]!.toUpperCase();
    if (rackCodeToIndex(aisle) < 1 || bay < 1 || bay > 99) {
      return null;
    }
    if (!SHELF_RE.test(shelfLetter)) {
      return null;
    }
    const shelfLevel = shelfLetter.charCodeAt(0) - "A".charCodeAt(0) + 1;
    return {
      raw: t,
      aisle,
      bay,
      shelfLetter,
      shelfLevel,
      bin: 0,
    };
  }
  const m3 = RACK_BAY_LEVEL_RE.exec(t);
  if (m3) {
    const aisle = m3[1]!.toUpperCase();
    const bay = parseInt(m3[2]!, 10);
    const shelfLetter = m3[3]!.toUpperCase();
    if (rackCodeToIndex(aisle) < 1 || !/^\d{1,2}$/.test(m3[2]!) || bay < 1 || bay > 99) {
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
      bin: 0,
    };
  }
  return null;
}

/**
 * Long tooltip: rack, bay, and shelf level only (no bin / position).
 */
export function kokobayLocationTitle(s: string): string {
  const p = parseKokobayLocation(s);
  if (!p) return s;
  const bayPadded = String(p.bay).padStart(2, "0");
  return `Rack ${p.aisle}, Bay ${bayPadded}, Level ${p.shelfLetter} (${p.shelfLevel})`;
}

/**
 * Walk order: rack → bay → level; legacy `B-04-C3` also sorts by slot (1–3).
 */
export function locationSortKey(loc: string): [number, number, number, number, string] {
  const p = parseKokobayLocation(loc);
  if (!p) return [999, 999, 9, 9, loc];
  const rackIdx = rackCodeToIndex(p.aisle) || 9999;
  const shelfI = p.shelfLetter.charCodeAt(0) - "A".charCodeAt(0);
  const t = loc.trim();
  if (RACK_BAY_LEVEL_RE.test(t) || BIN_FOUR_PART_LEGACY_RE.test(t)) {
    return [rackIdx, p.bay, shelfI, 0, p.raw];
  }
  return [rackIdx, p.bay, shelfI, p.bin, p.raw];
}

export function compareKokobayLocation(a: string, b: string): number {
  const ka = locationSortKey(a);
  const kb = locationSortKey(b);
  for (let i = 0; i < 4; i++) {
    if (ka[i] !== kb[i]) return ka[i]! < kb[i]! ? -1 : 1;
  }
  return ka[4].localeCompare(kb[4]);
}

const SHELVES = "ABCDEF" as const;

/**
 * Deterministic mock location, same shape as `POST /api/bins`: `RACK-BAY-LEVEL`
 * (e.g. `J-04-C`). Bay count follows `bayCountForRack`.
 */
export function randomKokobayLocationForIndex(i: number): string {
  const racks = KOKO_RACKS;
  const rack = racks[((i * 17) % 210) % racks.length]!;
  const maxBay = bayCountForRack(rack);
  const bay = 1 + ((i * 11 + 3) % maxBay);
  const level = SHELVES[(i * 5 + 1) % 6]!;
  return `${rack}-${String(bay).padStart(2, "0")}-${level}`;
}
