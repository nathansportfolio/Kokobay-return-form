/** Kokobay warehouse / public API — production by default. Override for local dev. */
export const KOKOBAY_PROD_API_ORIGIN = "https://kokobay-mizd.vercel.app";

export function kokobayUpstreamOrigin(): string {
  const override = process.env.KOKOBAY_API_ORIGIN?.trim();
  if (override) return override.replace(/\/$/, "");
  return KOKOBAY_PROD_API_ORIGIN;
}

export function kokobayUpstreamUrl(path: string, search = ""): string {
  const base = kokobayUpstreamOrigin();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const query = search.startsWith("?") ? search : search ? `?${search}` : "";
  return `${base}${normalizedPath}${query}`;
}
