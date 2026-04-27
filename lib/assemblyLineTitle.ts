/**
 * Splits a dashed line-item title like `The high neck suede mini - camel - 8`
 * into a product name, swatch, and size segment for assembly UI.
 */
export function parseDashedProductTitle(full: string): {
  product: string;
  colour?: string;
  size?: string;
} {
  const t = String(full).replace(/\s+/g, " ").trim();
  if (!t) {
    return { product: "—" };
  }
  const parts = t.split(/\s*[-–—]\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return {
      product: parts.slice(0, -2).join(" - "),
      colour: parts[parts.length - 2]!,
      size: parts[parts.length - 1]!,
    };
  }
  if (parts.length === 2) {
    return { product: parts[0]!, colour: parts[1]! };
  }
  return { product: t };
}
