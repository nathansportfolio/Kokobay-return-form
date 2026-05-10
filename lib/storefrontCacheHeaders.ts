import { API_JSON_CACHE_CONTROL } from "./apiCacheHeaders";

/** CDN / browser cache for Storefront-backed listing APIs (5 min TTL, SWR). */
export const STOREFRONT_COLLECTION_CACHE_CONTROL = API_JSON_CACHE_CONTROL;

export const STOREFRONT_SEARCH_CACHE_CONTROL = API_JSON_CACHE_CONTROL;

export const STOREFRONT_PREDICTIVE_CACHE_CONTROL = API_JSON_CACHE_CONTROL;

export function cacheHeaders(cacheControl: string): HeadersInit {
  return { "Cache-Control": cacheControl };
}
