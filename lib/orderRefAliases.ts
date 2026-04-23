/**
 * Dynamic route segments for `/returns/%2358153` may need multiple
 * `decodeURIComponent` passes; leaves `#58153` and plain `58153` unchanged.
 */
export function resolveOrderRefFromPathSegment(raw: string): string {
  let s = String(raw).trim();
  for (let i = 0; i < 6; i += 1) {
    if (!s.includes("%")) {
      return s;
    }
    try {
      const n = decodeURIComponent(s);
      if (n === s) {
        return s;
      }
      s = n.trim();
    } catch {
      return s;
    }
  }
  return s;
}

/**
 * Same Shopify order can be referenced as `1001`, `#1001`, or ` #1001 ` in URLs
 * and forms. Use this for Mongo matches so return logs and customer forms stay
 * linked to the warehouse return page.
 */
export function getOrderRefLookupAliases(orderRef: string): string[] {
  const t = String(orderRef).trim();
  if (!t) return [];
  const out = new Set([t]);
  if (t.startsWith("#") && t.length > 1) {
    out.add(t.slice(1).trim());
  } else if (/^\d+$/.test(t)) {
    out.add(`#${t}`);
  }
  return [...out].filter((s) => s.length > 0);
}
