import { PicklistColorSwatch } from "@/components/picklist/PicklistColorSwatch";
import { parseDashedProductTitle } from "@/lib/assemblyLineTitle";
import { formatDisplayColour } from "@/lib/formatDisplayColour";

type Props = {
  name: string;
  /** Line quantity to show as `1 ×` before the product. */
  quantity: number;
  /** When the title is a single segment, show this in bold (e.g. `line.color`). */
  lineColor?: string;
  /** Sits on the same row as colour / size. */
  colorHex?: string;
  /**
   * From Shopify `variant_title` (e.g. `Apricot / 10`) when the name string
   * is a flat product title without a dashed size.
   */
  size?: string;
};

/**
 * Assembly packing view: `N ×` + product name, then swatch + colour and size
 * in bold; no SKU in the line.
 */
export function AssemblyLineText({
  name,
  quantity,
  lineColor,
  colorHex,
  size: sizeFromLine,
}: Props) {
  const q = Math.max(1, Math.trunc(Number(quantity) || 0));
  const p = parseDashedProductTitle(name);
  const sizeForDisplay = (() => {
    const ex = (sizeFromLine ?? "").trim();
    if (ex) {
      return ex;
    }
    if (p.size != null && p.size !== "") {
      return p.size.trim();
    }
    return "";
  })();
  const colourForDisplay = (() => {
    if (p.colour != null && p.colour.trim() !== "") {
      return p.colour.trim();
    }
    if (lineColor && lineColor.trim() !== "—" && lineColor.trim() !== "") {
      return lineColor.trim();
    }
    return "";
  })();
  const showMeta = Boolean(colourForDisplay) || sizeForDisplay !== "";

  return (
    <div className="min-w-0 flex-1 text-left">
      <p
        className="text-sm font-medium leading-snug text-foreground"
        lang="en-GB"
      >
        <span className="font-bold tabular-nums text-foreground">{q}</span>
        <span className="text-zinc-500 dark:text-zinc-400" aria-hidden>
          {" "}
          ×
        </span>{" "}
        <span className="text-foreground">{p.product}</span>
      </p>
      {showMeta ? (
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm leading-snug text-zinc-700 dark:text-zinc-300">
          <PicklistColorSwatch hex={colorHex} className="self-center" />
          <span>
            {colourForDisplay ? (
              <span className="font-bold text-foreground">
                {formatDisplayColour(colourForDisplay)}
              </span>
            ) : null}
            {colourForDisplay && sizeForDisplay ? (
              <span className="font-medium text-zinc-400" aria-hidden>
                {" "}
                ·{" "}
              </span>
            ) : null}
            {sizeForDisplay ? (
              <span className="font-bold text-foreground">{sizeForDisplay}</span>
            ) : null}
          </span>
        </p>
      ) : null}
    </div>
  );
}
