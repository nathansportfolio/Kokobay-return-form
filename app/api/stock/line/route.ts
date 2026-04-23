import { NextResponse } from "next/server";
import { syncBinIsOccupiedFromStock } from "@/lib/binLayoutMutations";
import { ensureStockCollectionIndexes } from "@/lib/ensureStockCollectionIndexes";
import { parseKokobayLocation } from "@/lib/kokobayLocationFormat";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { type StockDocument, stockCollection } from "@/lib/warehouseStockTypes";

const BINS = "bins";

type Line = {
  productId: number;
  variantId: number;
  sku: string;
  quantity?: number;
};

function isLine(x: unknown): x is Line {
  if (typeof x !== "object" || x == null) return false;
  const o = x as Record<string, unknown>;
  return (
    Number.isFinite(o.productId as number) &&
    Number.isFinite(o.variantId as number) &&
    typeof o.sku === "string" &&
    (o.quantity == null || Number.isFinite(o.quantity as number))
  );
}

function normalizeWarehouseBinCode(raw: string): string | null {
  const t = String(raw ?? "").trim();
  const p = parseKokobayLocation(t);
  if (!p || t.split("-").length !== 3 || p.bin !== 0) {
    return null;
  }
  return [p.aisle, String(p.bay).padStart(2, "0"), p.shelfLetter].join("-");
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }
  if (typeof body !== "object" || body == null) {
    return NextResponse.json(
      { ok: false, error: "Invalid body" },
      { status: 400 },
    );
  }
  const b = body as { binCode?: string; lines?: unknown };
  const raw = String(b.binCode ?? "").trim();
  const binCode = normalizeWarehouseBinCode(raw);
  if (!binCode) {
    return NextResponse.json(
      { ok: false, error: "Invalid bin code" },
      { status: 400 },
    );
  }
  if (!Array.isArray(b.lines) || b.lines.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Add at least one line" },
      { status: 400 },
    );
  }
  const lines = b.lines.filter(isLine);
  if (lines.length !== b.lines.length) {
    return NextResponse.json(
      { ok: false, error: "Each line needs productId, variantId, sku" },
      { status: 400 },
    );
  }
  for (const line of lines) {
    if (line.quantity != null) {
      const q = Math.trunc(Number(line.quantity));
      if (!Number.isInteger(q) || q < 1) {
        return NextResponse.json(
          { ok: false, error: "Quantity must be a positive integer" },
          { status: 400 },
        );
      }
    }
  }

  try {
    const client = await clientPromise;
    const db = client.db(kokobayDbName);
    const okBin = await db
      .collection(BINS)
      .findOne({ code: binCode }, { projection: { _id: 1 } });
    if (!okBin) {
      return NextResponse.json(
        { ok: false, error: "This bin is not in the layout" },
        { status: 400 },
      );
    }

    await ensureStockCollectionIndexes(client);
    const col = stockCollection(db);
    const now = new Date();
    for (const line of lines) {
      const add = line.quantity == null ? 1 : Math.trunc(Number(line.quantity));
      const productId = Math.trunc(line.productId);
      const variantId = Math.trunc(line.variantId);
      const sku = String(line.sku).trim() || "—";
      if (!Number.isFinite(variantId) || variantId < 1) {
        return NextResponse.json(
          { ok: false, error: "Invalid variant" },
          { status: 400 },
        );
      }
      const existing = await col.findOne({ variantId });
      if (existing) {
        const inBin = normalizeWarehouseBinCode(
          String((existing as { binCode?: string }).binCode ?? ""),
        );
        if (inBin && inBin !== binCode) {
          return NextResponse.json(
            {
              ok: false,
              error: `This variant is already in bin ${inBin}. Remove it from there first if you want to move it.`,
            },
            { status: 409 },
          );
        }
        await col.updateOne(
          { variantId },
          {
            $set: { sku, productId, updatedAt: now, binCode },
            $inc: { quantity: add },
          },
        );
      } else {
        const doc: StockDocument = {
          binCode,
          productId,
          variantId,
          sku,
          quantity: add,
          updatedAt: now,
        };
        try {
          await col.insertOne(doc);
        } catch (e) {
          const err = e as { code?: number; message?: string };
          if (err.code === 11000) {
            return NextResponse.json(
              {
                ok: false,
                error:
                  "This variant is already in stock in another location (duplicate variant).",
              },
              { status: 409 },
            );
          }
          throw e;
        }
      }
    }
    await syncBinIsOccupiedFromStock(db);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[api/stock/line]", e);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }
  if (typeof body !== "object" || body == null) {
    return NextResponse.json(
      { ok: false, error: "Invalid body" },
      { status: 400 },
    );
  }
  const b = body as { binCode?: string; variantId?: unknown };
  const raw = String(b.binCode ?? "").trim();
  const binCode = normalizeWarehouseBinCode(raw);
  if (!binCode) {
    return NextResponse.json(
      { ok: false, error: "Invalid bin code" },
      { status: 400 },
    );
  }
  const variantId = Math.trunc(Number(b.variantId));
  if (!Number.isFinite(variantId) || variantId < 1) {
    return NextResponse.json(
      { ok: false, error: "Invalid variant" },
      { status: 400 },
    );
  }
  try {
    const client = await clientPromise;
    const db = client.db(kokobayDbName);
    const col = stockCollection(db);
    const existing = await col.findOne(
      { variantId },
      { projection: { binCode: 1, _id: 1 } },
    );
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "No stock row for that variant" },
        { status: 404 },
      );
    }
    const rowBin = normalizeWarehouseBinCode(
      String((existing as StockDocument).binCode ?? ""),
    );
    if (rowBin && rowBin !== binCode) {
      return NextResponse.json(
        {
          ok: false,
          error: "That product is in a different bin; refresh the page.",
        },
        { status: 400 },
      );
    }
    if (!rowBin) {
      const asStored = String(
        (existing as StockDocument).binCode ?? "",
      ).trim();
      if (asStored && asStored.toUpperCase() !== binCode) {
        return NextResponse.json(
          {
            ok: false,
            error: "That product is in a different bin; refresh the page.",
          },
          { status: 400 },
        );
      }
    }
    const del = await col.deleteOne({ variantId });
    if (del.deletedCount === 0) {
      return NextResponse.json(
        { ok: false, error: "Nothing removed" },
        { status: 500 },
      );
    }
    await syncBinIsOccupiedFromStock(db);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[api/stock/line DELETE]", e);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
