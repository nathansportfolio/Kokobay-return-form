/** API + UI payload for `POST /api/bins/layout`. */
export type LayoutAction =
  | {
      action: "addRack";
      rack: string;
      /** 1–99 */
      bayCount: number;
      /** 1–6 (levels A through nth letter) */
      levelCount: number;
    }
  | { action: "deleteRack"; rack: string }
  | { action: "addBay"; rack: string }
  | { action: "deleteBay"; rack: string; bay: string }
  | { action: "addLevel"; rack: string; bay: string; level: string }
  | { action: "addMissingLevels"; rack: string; bay: string }
  | { action: "deleteLevel"; code: string };

export type LayoutMutationResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export function isLayoutAction(body: unknown): body is LayoutAction {
  if (!body || typeof body !== "object") return false;
  const a = (body as { action?: string }).action;
  if (typeof a !== "string") return false;
  if (a === "addRack") {
    const b = body as { rack?: unknown; bayCount?: unknown; levelCount?: unknown };
    if (typeof b.rack !== "string") return false;
    const bc = Number(b.bayCount);
    const lc = Number(b.levelCount);
    if (!Number.isInteger(bc) || bc < 1 || bc > 99) return false;
    if (!Number.isInteger(lc) || lc < 1 || lc > 6) return false;
    return true;
  }
  if (a === "deleteRack") {
    return typeof (body as { rack?: string }).rack === "string";
  }
  if (a === "addBay") {
    return typeof (body as { rack?: string }).rack === "string";
  }
  if (a === "deleteBay") {
    return (
      typeof (body as { rack?: string }).rack === "string" &&
      typeof (body as { bay?: string }).bay === "string"
    );
  }
  if (a === "addLevel") {
    return (
      typeof (body as { rack?: string }).rack === "string" &&
      typeof (body as { bay?: string }).bay === "string" &&
      typeof (body as { level?: string }).level === "string"
    );
  }
  if (a === "addMissingLevels") {
    return (
      typeof (body as { rack?: string }).rack === "string" &&
      typeof (body as { bay?: string }).bay === "string"
    );
  }
  if (a === "deleteLevel") {
    return typeof (body as { code?: string }).code === "string";
  }
  return false;
}
