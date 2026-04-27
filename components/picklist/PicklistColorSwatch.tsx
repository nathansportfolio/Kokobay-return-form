type Props = {
  /** Fill when this is a valid `#rrggbb` from the server; otherwise conic rainbow. */
  hex?: string | null;
  className?: string;
  title?: string;
};

const RAINBOW =
  "conic-gradient(from 0deg, #f43f5e, #fbbf24, #22c55e, #38bdf8, #6366f1, #a855f7, #f43f5e)";

/**
 * Small circle: solid **hex** when known, otherwise a **rainbow** (multi/unspecified colour).
 */
export function PicklistColorSwatch({ hex, className = "", title }: Props) {
  const h = hex?.trim();
  const isHex = /^#[0-9A-Fa-f]{6}$/.test(h ?? "");
  return (
    <span
      className={`inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-zinc-400/80 shadow-sm dark:border-zinc-500/80 ${className}`}
      style={
        isHex
          ? { backgroundColor: h }
          : { background: RAINBOW }
      }
      title={
        title ??
        (isHex ? `Colour swatch ${h}` : "Multiple or unspecified colour")
      }
      aria-hidden
    />
  );
}
