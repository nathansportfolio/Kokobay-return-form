import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { compareRackCode } from "@/lib/warehouseRackLayout";

const LEVEL_ORDER = "ABCDEF";

export type BinsLayoutLevel = {
  level: string;
  code: string;
  isOccupied: boolean;
};

export type BinsLayoutBay = {
  /** Two-digit string, e.g. "04" */
  bay: string;
  levels: BinsLayoutLevel[];
};

export type BinsLayoutRack = {
  rack: string;
  /** Physical grouping: A–I single, J–Z single, multi-letter (AA+). */
  section: "A–I" | "J–Z" | "AA+";
  bays: BinsLayoutBay[];
};

function rackDisplaySection(rack: string): BinsLayoutRack["section"] {
  if (rack.length > 1) {
    return "AA+";
  }
  if (rack >= "A" && rack < "J") {
    return "A–I";
  }
  return "J–Z";
}

export type BinsLayoutResult =
  | {
      ok: true;
      totalBins: number;
      occupiedCount: number;
      racks: BinsLayoutRack[];
    }
  | { ok: false; error: string; racks: [] };

function sortLevel(a: BinsLayoutLevel, b: BinsLayoutLevel): number {
  return (
    LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) ||
    a.code.localeCompare(b.code)
  );
}

function sortBay(a: BinsLayoutBay, b: BinsLayoutBay): number {
  return parseInt(a.bay, 10) - parseInt(b.bay, 10);
}

/**
 * Reads Mongo `bins` and returns a tree: rack → bay → levels, for the
 * warehouse layout page. Racks with no documents are omitted.
 */
export async function getBinsLayoutTree(): Promise<BinsLayoutResult> {
  try {
    const client = await clientPromise;
    const col = client.db(kokobayDbName).collection("bins");
    const docs = await col
      .find(
        {},
        {
          projection: {
            _id: 0,
            code: 1,
            rack: 1,
            bay: 1,
            level: 1,
            isOccupied: 1,
          },
        },
      )
      .toArray();

    if (docs.length === 0) {
      return {
        ok: true,
        totalBins: 0,
        occupiedCount: 0,
        racks: [],
      };
    }

    type Row = {
      code?: string;
      rack?: string;
      bay?: string;
      level?: string;
      isOccupied?: boolean;
    };

    const byRack = new Map<
      string,
      Map<string, BinsLayoutLevel[]>
    >();

    let occupiedCount = 0;
    for (const d of docs) {
      const r = d as Row;
      const rack = String(r.rack ?? "").trim().toUpperCase();
      const bay = String(r.bay ?? "").trim();
      const level = String(r.level ?? "").trim().toUpperCase();
      const code = String(r.code ?? "").trim();
      if (!rack || !bay || !level || !code) continue;
      if (r.isOccupied) occupiedCount += 1;

      let bays = byRack.get(rack);
      if (!bays) {
        bays = new Map();
        byRack.set(rack, bays);
      }
      const key = bay.padStart(2, "0");
      const list = bays.get(key) ?? [];
      list.push({
        level,
        code,
        isOccupied: Boolean(r.isOccupied),
      });
      bays.set(key, list);
    }

    const rackOrder = [...byRack.keys()].sort(compareRackCode);
    const racks: BinsLayoutRack[] = [];
    for (const rack of rackOrder) {
      const bays = byRack.get(rack);
      if (!bays || bays.size === 0) continue;

      const bayList: BinsLayoutBay[] = [];
      for (const bay of [...bays.keys()].sort(
        (a, b) => parseInt(a, 10) - parseInt(b, 10),
      )) {
        const levels = (bays.get(bay) ?? []).slice().sort(sortLevel);
        bayList.push({ bay, levels });
      }
      bayList.sort(sortBay);

      racks.push({
        rack,
        section: rackDisplaySection(rack),
        bays: bayList,
      });
    }

    return {
      ok: true,
      totalBins: docs.length,
      occupiedCount,
      racks,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: message, racks: [] };
  }
}
