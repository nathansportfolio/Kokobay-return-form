/**
 * Racks: Excel-style names `A` … `Z`, then `AA`, `AB`, … (used for bins, stock, picks).
 * Default full seed: single-letter A–U only; new racks from the UI use the next name in
 * that sequence.
 */
export const KOKO_RACKS = "ABCDEFGHIJKLMNOPQRSTU" as const;

const MAX_RACK_NAME_LEN = 6;

/**
 * 1 = A, 26 = Z, 27 = AA, … (Excel column numbering).
 * Returns 0 for invalid (empty, non A–Z, or too long).
 */
export function rackCodeToIndex(name: string): number {
  const t = String(name)
    .trim()
    .toUpperCase();
  if (!/^[A-Z]+$/.test(t) || t.length < 1 || t.length > MAX_RACK_NAME_LEN) {
    return 0;
  }
  let n = 0;
  for (let i = 0; i < t.length; i++) {
    n = n * 26 + (t.charCodeAt(i)! - 64);
  }
  return n;
}

/**
 * 1 → A, 27 → AA, etc.
 */
export function indexToRackCode(n: number): string {
  if (!Number.isInteger(n) || n < 1) {
    return "A";
  }
  let s = "";
  let num = n;
  while (num > 0) {
    const rem = (num - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s;
}

/**
 * A–Z letters only, length 1–6 (A … ZZZZZZ cap).
 */
export function isValidRackName(s: string): boolean {
  const t = String(s)
    .trim()
    .toUpperCase();
  if (t.length < 1 || t.length > MAX_RACK_NAME_LEN) return false;
  return /^[A-Z]+$/.test(t) && rackCodeToIndex(t) > 0;
}

/**
 * After all existing names, the next in A…Z, AA, AB, …
 */
export function nextRackCodeFromExisting(
  existingRacks: Set<string> | string[],
): string {
  const have = new Set(
    Array.isArray(existingRacks) ? existingRacks : [...existingRacks],
  );
  let max = 0;
  for (const r of have) {
    const idx = rackCodeToIndex(String(r).trim().toUpperCase());
    if (idx > max) max = idx;
  }
  return indexToRackCode(max + 1);
}

/**
 * Default sort for rack labels: A, B, …, Z, AA, AB, …
 */
export function compareRackCode(a: string, b: string): number {
  const ai = rackCodeToIndex(a);
  const bi = rackCodeToIndex(b);
  if (ai > 0 && bi > 0 && ai !== bi) {
    return ai < bi ? -1 : 1;
  }
  if (ai > 0 && bi === 0) return -1;
  if (ai === 0 && bi > 0) return 1;
  return a.localeCompare(b);
}

/** Aisle indices 1–9 (A–I): first physical run. */
export function isFirstPhysicalRunAisleIndex(index: number): boolean {
  return index >= 1 && index <= 9;
}

/**
 * Bays per rack (physical). Single-letter A = 13; B–I = 4; J–U = 5. Anything else
 * (V…Z, AA+, …) defaults to 5.
 */
export function bayCountForRack(rack: string): number {
  const r = String(rack ?? "")
    .trim()
    .toUpperCase();
  if (r.length === 1 && r >= "A" && r <= "Z") {
    if (r === "A") {
      return 13;
    }
    if (r >= "B" && r <= "I") {
      return 4;
    }
    if (r >= "J" && r <= "U") {
      return 5;
    }
  }
  return 5;
}
