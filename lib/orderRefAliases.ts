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
