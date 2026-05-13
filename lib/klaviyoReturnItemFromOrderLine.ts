import { parseDashedProductTitle } from "@/lib/assemblyLineTitle";
import {
  CUSTOMER_FORM_REASON_UNSET,
  customerFormReasonLabel,
} from "@/lib/customerReturnFormReasons";
import { isLikelySizeOnlyToken } from "@/lib/shopifyProductCatalog";
import {
  splitSizeAndColourFromSlashToken,
  splitSizeFromColourParens,
} from "@/lib/splitSizeFromColourParens";

export type KlaviyoReturnItemPayload = {
  name: string;
  size: string;
  reason: string;
};

/**
 * Maps a warehouse order line title + return reason into Klaviyo `returnItems[]`
 * shape (name, size, reason).
 *
 * For `/api/klaviyo/return-rejected`, the UI overrides `reason` with trimmed warehouse
 * **Notes** (rejection explanation), not `reasonValue`.
 */
export function buildKlaviyoReturnItemFromLineTitleAndReason(
  title: string,
  reasonValue: string | null,
): KlaviyoReturnItemPayload {
  const reason =
    !reasonValue || reasonValue === CUSTOMER_FORM_REASON_UNSET
      ? "No reason given"
      : customerFormReasonLabel(reasonValue);

  const t = String(title ?? "").replace(/\s+/g, " ").trim();
  if (!t) {
    return { name: "—", size: "—", reason };
  }

  const paren = splitSizeFromColourParens(t);
  if (paren.sizeFromParens) {
    return {
      name: (paren.colour || t).trim() || "—",
      size: paren.sizeFromParens,
      reason,
    };
  }

  const dashed = parseDashedProductTitle(t);
  if (dashed.size?.trim()) {
    const nameParts = [dashed.product];
    if (dashed.colour?.trim()) nameParts.push(dashed.colour.trim());
    return {
      name: nameParts.join(" · ").trim() || t,
      size: dashed.size.trim(),
      reason,
    };
  }

  const slash = splitSizeAndColourFromSlashToken(t);
  if (slash?.sizeIfSplit) {
    return {
      name: slash.colourOnly.trim() || t,
      size: slash.sizeIfSplit,
      reason,
    };
  }

  const segs = t.split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
  if (segs.length >= 2) {
    const last = segs[segs.length - 1]!;
    if (isLikelySizeOnlyToken(last)) {
      return {
        name: segs.slice(0, -1).join(" / ").trim() || t,
        size: last,
        reason,
      };
    }
  }

  return { name: t, size: "—", reason };
}
