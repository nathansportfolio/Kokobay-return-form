import type { ShopifyLineItem } from "@/types/shopify";

/** Same string as the REST line item row in the Admin, for titles + generated SKUs. */
export function lineItemTitle(
  li: Pick<ShopifyLineItem, "title" | "variant_title">,
): string {
  const t = (li.title ?? "").trim() || "Item";
  const vt = li.variant_title?.trim();
  if (!vt || vt === "Default Title") return t;
  return `${t} – ${vt}`;
}
