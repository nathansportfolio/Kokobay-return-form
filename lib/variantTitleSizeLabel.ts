import { parseDashedProductTitle } from "@/lib/assemblyLineTitle";
import { lineItemTitle } from "@/lib/shopifyLineItemTitle";
import type { ShopifyLineItem } from "@/types/shopify";

/**
 * Pulls a pack-friendly size (or the trailing option) from Shopify
 * `line_item.variant_title` (often `Colour / Size` or a lone size).
 */
export function sizeLabelFromShopifyVariantTitle(
  variantTitle: string | null | undefined,
  lineColor?: string,
): string | undefined {
  const t = String(variantTitle ?? "").replace(/\s+/g, " ").trim();
  if (!t || t === "Default Title") {
    return undefined;
  }
  const segs = t.split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
  if (segs.length >= 2) {
    const last = segs[segs.length - 1]!;
    return last || undefined;
  }
  const one = segs[0]!;
  const c = (lineColor ?? "").trim();
  if (c && c !== "—" && c.toLowerCase() === one.toLowerCase()) {
    return undefined;
  }
  if (
    /^(?:[0-9]+|(?:[0-9]|[0-9]{2}\/[0-9]{1,2})|(?:xxs|xs|s|m|l|xl|xxl|xxxl|os|one size|o\/?s|small|medium|large))$/i.test(
      one,
    ) ||
    /^uk\s*\d+$/i.test(one) ||
    /^\d+(?:\s*[-–]\s*\d+)?$/.test(one)
  ) {
    return one;
  }
  return undefined;
}

function sizeFromLineItemPropertyList(
  properties: { name: string; value: string }[] | undefined,
): string | undefined {
  if (!Array.isArray(properties) || properties.length === 0) {
    return undefined;
  }
  for (const pr of properties) {
    const n = String(pr?.name ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (!n) {
      continue;
    }
    if (n === "size" || n.endsWith(" size") || n === "uk size" || n === "us size") {
      const v = String(pr?.value ?? "")
        .replace(/\s+/g, " ")
        .trim();
      if (v) {
        return v;
      }
    }
  }
  return undefined;
}

/**
 * `li.name` is the full line as shown on the order; `variant_title` is often
 * just the colour. Mongo product title may be used for display and hide size,
 * so we always use raw line fields.
 */
export function sizeFromShopifyLineItem(
  li: Pick<ShopifyLineItem, "name" | "title" | "variant_title" | "properties">,
  lineColor: string | undefined,
): string | undefined {
  const fromProp = sizeFromLineItemPropertyList(li.properties);
  if (fromProp) {
    return fromProp;
  }

  const fromVt = sizeLabelFromShopifyVariantTitle(li.variant_title, lineColor);
  if (fromVt) {
    return fromVt;
  }

  const orderLineName = (typeof li.name === "string" ? li.name : "")
    .replace(/\s+/g, " ")
    .trim();
  if (orderLineName) {
    const p = parseDashedProductTitle(orderLineName);
    if (p.size?.trim()) {
      return p.size.trim();
    }
    if (p.colour?.includes("/")) {
      const s = sizeLabelFromShopifyVariantTitle(p.colour, lineColor);
      if (s) {
        return s;
      }
    }
  }

  const built = lineItemTitle(li);
  if (built) {
    const p = parseDashedProductTitle(built);
    if (p.size?.trim()) {
      return p.size.trim();
    }
    if (p.colour?.includes("/")) {
      return sizeLabelFromShopifyVariantTitle(p.colour, lineColor);
    }
  }
  return undefined;
}
