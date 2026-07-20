"use client";

import type { AffiliateSeriesPoint } from "@/lib/affiliate/types";
import { formatSeriesLabel } from "@/lib/affiliate/api";

export function AffiliateAreaChart({
  series,
  ariaLabel,
}: {
  series: AffiliateSeriesPoint[];
  ariaLabel: string;
}) {
  const width = 640;
  const height = 240;
  const padX = 12;
  const padY = 16;
  if (series.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[#7A746C]">No data yet</p>
    );
  }

  const values = series.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = 0;
  const span = Math.max(max - min, 1);

  const coords = series.map((p, i) => {
    const x =
      padX +
      (series.length <= 1
        ? (width - padX * 2) / 2
        : (i / (series.length - 1)) * (width - padX * 2));
    const y = height - padY - ((p.value - min) / span) * (height - padY * 2);
    return { x, y, label: formatSeriesLabel(p.date), value: p.value };
  });

  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${coords[coords.length - 1]!.x.toFixed(1)} ${
    height - padY
  } L ${coords[0]!.x.toFixed(1)} ${height - padY} Z`;

  const labelEvery = Math.max(1, Math.ceil(series.length / 5));

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id="aff-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F0A8A8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#F0A8A8" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#aff-chart-fill)" />
        <path
          d={line}
          fill="none"
          stroke="#E89292"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((c) => (
          <circle
            key={`${c.label}-${c.value}`}
            cx={c.x}
            cy={c.y}
            r="3.5"
            fill="#fff"
            stroke="#E89292"
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="mt-2 flex justify-between gap-2 px-1 text-[11px] text-[#8A8580]">
        {series.map((p, i) =>
          i % labelEvery === 0 || i === series.length - 1 ? (
            <span key={`${p.date}-${i}`} className="tabular-nums">
              {formatSeriesLabel(p.date)}
            </span>
          ) : (
            <span key={`${p.date}-${i}`} className="invisible" aria-hidden>
              ·
            </span>
          ),
        )}
      </div>
    </div>
  );
}
