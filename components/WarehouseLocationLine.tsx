import type { CSSProperties } from "react";
import {
  binAisleLetter,
  binBadgeStyleFromBin,
} from "@/lib/warehouseLocationCodes";

export function WarehouseLocationLine({
  row,
  bin,
}: {
  row: string;
  bin: string;
}) {
  const letter = binAisleLetter(bin);
  const binStyle: CSSProperties = binBadgeStyleFromBin(bin);
  return (
    <p className="text-base font-semibold tracking-tight text-foreground">
      <span>{row}</span>
      <span className="mx-1.5 text-zinc-400 dark:text-zinc-500">·</span>
      <span
        className="inline-block rounded-md px-2 py-0.5 font-mono text-sm tabular-nums"
        style={binStyle}
        title={`Aisle ${letter} — strong colour per letter (A green, B lime, C blue, … Z red)`}
      >
        {bin}
      </span>
    </p>
  );
}
