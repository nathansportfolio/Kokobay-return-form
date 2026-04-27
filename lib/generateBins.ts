import {
  bayCountForRack,
  isValidRackName,
  KOKO_RACKS,
} from "@/lib/warehouseRackLayout";

/** Shelf levels (low → high) for `RACK-BAY-LEVEL` codes. */
export const SHELF_LEVELS = ["A", "B", "C", "D", "E", "F"] as const;
const LEVELS = SHELF_LEVELS;

export type BinLocation = {
  code: string;
  rack: string;
  bay: string;
  level: string;
  isOccupied: boolean;
};

/**
 * `[RACK]-[BAY]-[LEVEL]`, e.g. `A-02-D` — parseable with `parseKokobayLocation`
 * (`RACK_BAY_LEVEL_RE`). 6 levels (A–F); bay counts follow `bayCountForRack`
 * (A: 13, B–I: 4, J–U: 5).
 */
let _allLayoutBinCodes: string[] | null = null;

/**
 * Every `RACK-BAY-LEVEL` code in the default layout, sorted. Same set as
 * `POST /api/bins` — use for stable fallback walk codes when `stock` has no row.
 */
export function allKokobayLayoutBinCodes(): string[] {
  if (_allLayoutBinCodes) return _allLayoutBinCodes;
  _allLayoutBinCodes = generateBins()
    .map((b) => b.code)
    .sort((a, b) => a.localeCompare(b));
  return _allLayoutBinCodes;
}

export function generateBins(): BinLocation[] {
  const bins: BinLocation[] = [];
  const rows = KOKO_RACKS.split("");

  for (const row of rows) {
    const binCount = bayCountForRack(row);

    for (let bay = 1; bay <= binCount; bay += 1) {
      const bayStr = String(bay).padStart(2, "0");

      for (const level of LEVELS) {
        bins.push({
          code: `${row}-${bayStr}-${level}`,
          rack: row,
          bay: bayStr,
          level,
          isOccupied: false,
        });
      }
    }
  }

  return bins;
}

/**
 * All standard bays and levels for one rack (uses `bayCountForRack`), e.g. add a
 * new rack to Mongo without reseeding the full warehouse.
 */
export function generateBinsForRack(rack: string): BinLocation[] {
  const row = String(rack ?? "")
    .trim()
    .toUpperCase();
  if (!isValidRackName(row)) {
    return [];
  }
  const binCount = bayCountForRack(row);
  const bins: BinLocation[] = [];
  for (let bay = 1; bay <= binCount; bay += 1) {
    const bayStr = String(bay).padStart(2, "0");
    for (const level of LEVELS) {
      bins.push({
        code: `${row}-${bayStr}-${level}`,
        rack: row,
        bay: bayStr,
        level,
        isOccupied: false,
      });
    }
  }
  return bins;
}

/**
 * Custom rack footprint: `bayCount` bays (01…), `levelCount` levels using the
 * first N letters in {@link SHELF_LEVELS} (1 = A only … 6 = A–F).
 */
export function generateBinsForRackWithDimensions(
  rack: string,
  bayCount: number,
  levelCount: number,
): BinLocation[] {
  const row = String(rack ?? "")
    .trim()
    .toUpperCase();
  if (!isValidRackName(row)) {
    return [];
  }
  const bays = Math.min(99, Math.max(1, Math.floor(bayCount)));
  const nLevels = Math.min(6, Math.max(1, Math.floor(levelCount)));
  const levelLetters = LEVELS.slice(0, nLevels);
  const bins: BinLocation[] = [];
  for (let bay = 1; bay <= bays; bay += 1) {
    const bayStr = String(bay).padStart(2, "0");
    for (const level of levelLetters) {
      bins.push({
        code: `${row}-${bayStr}-${level}`,
        rack: row,
        bay: bayStr,
        level,
        isOccupied: false,
      });
    }
  }
  return bins;
}
