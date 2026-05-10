/**
 * Default HTTP cache for JSON route handlers: five minutes (`max-age` /
 * `s-maxage`) plus `stale-while-revalidate` for smoother responses under load.
 */
export const API_JSON_CACHE_CONTROL =
  "public, max-age=300, s-maxage=300, stale-while-revalidate=900";

export function apiJsonCacheHeaders(): HeadersInit {
  return { "Cache-Control": API_JSON_CACHE_CONTROL };
}
