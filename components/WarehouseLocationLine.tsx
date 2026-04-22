"use client";

import type { CSSProperties } from "react";
import {
  kokobayLocationTitle,
  parseKokobayLocation,
} from "@/lib/kokobayLocationFormat";
import { NEUTRAL_BADGE, SEP, shelfBinBadgeStyle } from "@/lib/warehouseLocationCodes";

/**
 * e.g. `A-08-B1` as three parts: [A] · [08] · [B1] — only the shelf+bin (B1) is
 * on a green → darker green scale; aisle and bay are neutral chips.
 */
export function WarehouseLocationLine({ location }: { location: string }) {
  const p = parseKokobayLocation(location);
  const shelfBinStyle: CSSProperties = p
    ? shelfBinBadgeStyle(p.shelfLetter, p.bin)
    : { backgroundColor: "hsl(146 50% 36%)", color: "white" };
  const shelfBinLabel = p ? `${p.shelfLetter.toUpperCase()}${p.bin}` : "—";
  const title = kokobayLocationTitle(location);

  if (!p) {
    return (
      <p className="text-base font-semibold tracking-tight text-foreground">
        <span
          className="font-mono text-sm tabular-nums"
          title={location}
        >
          {location}
        </span>
      </p>
    );
  }

  const bayPadded = String(p.bay).padStart(2, "0");

  return (
    <p className="text-base font-semibold tracking-tight text-foreground">
      <span
        className="inline-flex flex-wrap items-center gap-1 font-mono text-sm tabular-nums"
        title={title}
      >
        <span className={NEUTRAL_BADGE}>{p.aisle}</span>
        <span className={SEP} aria-hidden>
          -
        </span>
        <span className={NEUTRAL_BADGE}>{bayPadded}</span>
        <span className={SEP} aria-hidden>
          -
        </span>
        <span
          className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md px-1.5 py-0.5 font-semibold"
          style={shelfBinStyle}
        >
          {shelfBinLabel}
        </span>
      </span>
    </p>
  );
}
