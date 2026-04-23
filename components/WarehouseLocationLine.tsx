"use client";

import type { CSSProperties } from "react";
import { kokobayLocationTitle, parseKokobayLocation } from "@/lib/kokobayLocationFormat";
import { NEUTRAL_BADGE, SEP, shelfBinBadgeStyle } from "@/lib/warehouseLocationCodes";

/**
 * Three parts: rack, bay, level (coloured letter). Legacy `B-04-C3` is still
 * supported; the slot digit is not shown in the chip but is used for sort.
 */
export function WarehouseLocationLine({ location }: { location: string }) {
  const p = parseKokobayLocation(location);
  const shelfBinStyle: CSSProperties = p
    ? shelfBinBadgeStyle(p.shelfLetter, 1)
    : { backgroundColor: "hsl(146 50% 36%)", color: "white" };
  const shelfBinLabel = p ? p.shelfLetter.toUpperCase() : "—";
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
