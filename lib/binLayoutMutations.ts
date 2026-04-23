import type { Db } from "mongodb";
import type { LayoutAction, LayoutMutationResult } from "@/lib/binLayoutTypes";
import {
  generateBinsForRackWithDimensions,
  SHELF_LEVELS,
  type BinLocation,
} from "@/lib/generateBins";
import { isValidRackName } from "@/lib/warehouseRackLayout";
import { stockCollection } from "@/lib/warehouseStockTypes";

const BINS = "bins";

function normRack(r: string): string {
  return String(r ?? "")
    .trim()
    .toUpperCase();
}

function normBay(b: string): string {
  const n = parseInt(String(b).trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 99) {
    return "";
  }
  return String(n).padStart(2, "0");
}

function normLevel(l: string): string {
  const t = String(l ?? "")
    .trim()
    .toUpperCase();
  return /^[A-F]$/i.test(t) ? t : "";
}

export async function syncBinIsOccupiedFromStock(db: Db): Promise<void> {
  const bins = db.collection(BINS);
  const stock = stockCollection(db);
  const codes = await stock
    .aggregate<{ _id: string }>([
      { $group: { _id: "$binCode" } },
    ])
    .toArray();
  const withStock = new Set(
    codes.map((c) => String(c._id ?? "").trim()).filter(Boolean),
  );
  await bins.updateMany({}, { $set: { isOccupied: false } });
  if (withStock.size > 0) {
    await bins.updateMany(
      { code: { $in: [...withStock] } },
      { $set: { isOccupied: true } },
    );
  }
}

async function deleteStockForBinCodes(db: Db, binCodes: string[]): Promise<void> {
  if (binCodes.length === 0) return;
  const stock = stockCollection(db);
  await stock.deleteMany({ binCode: { $in: binCodes } });
}

/**
 * Mutates `bins` (+ related `stock` rows) and refreshes `isOccupied` flags.
 */
export async function runLayoutMutation(
  db: Db,
  body: LayoutAction,
): Promise<LayoutMutationResult> {
  const bins = db.collection<BinLocation & { isOccupied?: boolean }>(BINS);

  if (body.action === "addRack") {
    const rack = normRack(body.rack);
    if (!isValidRackName(rack)) {
      return {
        ok: false,
        error:
          "Rack must be A–Z letters only (e.g. A, Z, AA, AB) up to 6 characters.",
      };
    }
    const bc = Math.floor(Number(body.bayCount));
    const lc = Math.floor(Number(body.levelCount));
    if (!Number.isInteger(bc) || bc < 1 || bc > 99) {
      return { ok: false, error: "Bay count must be an integer from 1 to 99." };
    }
    if (!Number.isInteger(lc) || lc < 1 || lc > 6) {
      return { ok: false, error: "Level count must be an integer from 1 to 6 (A–F)." };
    }
    const existing = await bins.countDocuments({ rack });
    if (existing > 0) {
      return { ok: false, error: `Rack ${rack} already has bins. Delete it first to recreate.` };
    }
    const docs = generateBinsForRackWithDimensions(rack, bc, lc);
    if (docs.length === 0) {
      return { ok: false, error: "Could not generate bins for that rack." };
    }
    await bins.insertMany(docs, { ordered: false });
    await syncBinIsOccupiedFromStock(db);
    return {
      ok: true,
      message: `Added rack ${rack} (${bc} bays × ${lc} level${lc === 1 ? "" : "s"}, ${docs.length} bin locations).`,
    };
  }

  if (body.action === "deleteRack") {
    const rack = normRack(body.rack);
    if (!rack) {
      return { ok: false, error: "Invalid rack." };
    }
    const list = await bins
      .find({ rack })
      .project({ code: 1, _id: 0 })
      .toArray();
    const binCodes = list
      .map((d) => String((d as { code?: string }).code ?? ""))
      .filter(Boolean);
    await deleteStockForBinCodes(db, binCodes);
    const r = await bins.deleteMany({ rack });
    await syncBinIsOccupiedFromStock(db);
    return { ok: true, message: `Removed rack ${rack} (${r.deletedCount} bin locations).` };
  }

  if (body.action === "addBay") {
    const rack = normRack(body.rack);
    if (!rack) {
      return { ok: false, error: "Invalid rack." };
    }
    const maxDoc = await bins
      .find({ rack })
      .sort({ bay: -1 })
      .limit(1)
      .project({ bay: 1, _id: 0 })
      .toArray();
    let next = 1;
    if (maxDoc.length > 0) {
      const b = String((maxDoc[0] as { bay?: string }).bay ?? "0");
      next = parseInt(b, 10) + 1;
    }
    if (next > 99) {
      return { ok: false, error: "Bay number cannot exceed 99." };
    }
    const bayStr = String(next).padStart(2, "0");
    const docs: BinLocation[] = [];
    for (const level of SHELF_LEVELS) {
      docs.push({
        code: `${rack}-${bayStr}-${level}`,
        rack,
        bay: bayStr,
        level,
        isOccupied: false,
      });
    }
    try {
      await bins.insertMany(docs, { ordered: true });
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Insert failed (duplicate code?)",
      };
    }
    await syncBinIsOccupiedFromStock(db);
    return { ok: true, message: `Added bay ${bayStr} on rack ${rack} (6 levels).` };
  }

  if (body.action === "deleteBay") {
    const rack = normRack(body.rack);
    const bay = normBay(body.bay);
    if (!rack || !bay) {
      return { ok: false, error: "Invalid rack or bay." };
    }
    const list = await bins
      .find({ rack, bay })
      .project({ code: 1, _id: 0 })
      .toArray();
    const binCodes = list
      .map((d) => String((d as { code?: string }).code ?? ""))
      .filter(Boolean);
    await deleteStockForBinCodes(db, binCodes);
    const r = await bins.deleteMany({ rack, bay });
    await syncBinIsOccupiedFromStock(db);
    return { ok: true, message: `Removed bay ${bay} on rack ${rack} (${r.deletedCount} levels).` };
  }

  if (body.action === "addLevel") {
    const rack = normRack(body.rack);
    const bay = normBay(body.bay);
    const level = normLevel(body.level);
    if (!rack || !bay || !level) {
      return { ok: false, error: "Rack, bay, and level (A–F) are required." };
    }
    const code = `${rack}-${bay}-${level}`;
    const exists = await bins.countDocuments({ code });
    if (exists > 0) {
      return { ok: false, error: `Location ${code} already exists.` };
    }
    await bins.insertOne({
      code,
      rack,
      bay,
      level,
      isOccupied: false,
    });
    await syncBinIsOccupiedFromStock(db);
    return { ok: true, message: `Added level ${level} at ${rack}-${bay}.` };
  }

  if (body.action === "addMissingLevels") {
    const rack = normRack(body.rack);
    const bay = normBay(body.bay);
    if (!rack || !bay) {
      return { ok: false, error: "Invalid rack or bay." };
    }
    const have = new Set(
      (
        await bins
          .find({ rack, bay })
          .project({ level: 1, _id: 0 })
          .toArray()
      ).map((d) => String((d as { level?: string }).level ?? "").toUpperCase()),
    );
    const toAdd: BinLocation[] = [];
    for (const level of SHELF_LEVELS) {
      if (!have.has(level)) {
        toAdd.push({
          code: `${rack}-${bay}-${level}`,
          rack,
          bay,
          level,
          isOccupied: false,
        });
      }
    }
    if (toAdd.length === 0) {
      return { ok: false, error: "All levels A–F already exist for this bay." };
    }
    await bins.insertMany(toAdd, { ordered: true });
    await syncBinIsOccupiedFromStock(db);
    return {
      ok: true,
      message: `Added ${toAdd.length} missing level(s) on ${rack}-${bay}.`,
    };
  }

  if (body.action === "deleteLevel") {
    const code = String(body.code ?? "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z]+-\d{1,2}-[A-F]$/i.test(code)) {
      return { ok: false, error: "Invalid bin code (expected RACK-BAY-LEVEL)." };
    }
    const normalized = code
      .replace(/^([A-Z]+)-(\d{1,2})-([A-F])$/i, (_, a, b, c) => {
        const bay = String(parseInt(b, 10)).padStart(2, "0");
        return `${a.toUpperCase()}-${bay}-${c.toUpperCase()}`;
      });
    const r = await bins.deleteOne({ code: normalized });
    if (r.deletedCount === 0) {
      return { ok: false, error: `No bin found for ${code}.` };
    }
    await deleteStockForBinCodes(db, [normalized]);
    await syncBinIsOccupiedFromStock(db);
    return { ok: true, message: `Removed ${normalized}.` };
  }

  return { ok: false, error: "Unknown action." };
}
