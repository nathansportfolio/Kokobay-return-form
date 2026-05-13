import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isValidSiteAccessRole,
  isSiteAccessEnforced,
  SITE_ACCESS_COOKIE,
} from "@/lib/siteAccess";

/**
 * Product + collection JSON proxies — skip PIN cookie so mobile / curl can hit them.
 * Includes `product-stock` (storefront `.js` proxy) for cross-origin theme use.
 * Routes are unauthenticated; Shopify Admin credentials stay server-only.
 */
function isProductsApiPath(pathname: string): boolean {
  if (pathname === "/api/products" || pathname === "/api/products/") {
    return true;
  }
  if (pathname === "/api/product-stock" || pathname === "/api/product-stock/") {
    return true;
  }
  if (pathname === "/api/collections" || pathname === "/api/collections/") {
    return true;
  }
  return /^\/api\/products\/[0-9]+\/?$/.test(pathname);
}

/** Storefront GraphQL proxies (`/api/search`, `/api/collections/:handle`) — same model as products. */
function isStorefrontApiPath(pathname: string): boolean {
  if (pathname === "/api/search" || pathname.startsWith("/api/search/")) {
    return true;
  }
  // Dynamic collection by handle, not the Admin list at `/api/collections`.
  if (/^\/api\/collections\/[^/]+\/?$/.test(pathname)) {
    return true;
  }
  return false;
}

/** Unauthenticated access for Next internals, static assets, login, and customer return form + its APIs. */
function isPublicPath(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (pathname === "/login" || pathname === "/favicon.ico") {
    return true;
  }
  if (pathname.startsWith("/_next")) {
    return true;
  }
  if (pathname === "/returns/form") {
    return true;
  }
  if (
    pathname === "/api/returns/preview-order" ||
    pathname === "/api/returns/customer-form"
  ) {
    return true;
  }
  /**
   * TEMP: delete when removing `app/api/picklists/debug-delivery-temp/`
   * (unauthenticated `curl` for shipping-line inspection; no cookie).
   */
  if (pathname === "/api/picklists/debug-delivery-temp") {
    return true;
  }
  /**
   * Cart Intelligence pixel ingest — Shopify Custom Pixel runs in a
   * sandboxed iframe with no Kokobay cookies, so it must bypass the PIN.
   *
   * Public for **any** request method (POST, OPTIONS preflight, HEAD, etc.)
   * and for both with-/without trailing slash, so a Shopify shop hitting it
   * from a sandboxed Web Pixel iframe is never redirected to `/login`.
   *
   * The `report` endpoint is *not* listed here; that one stays admin-only.
   */
  if (
    pathname === "/api/cart-intelligence/event" ||
    pathname === "/api/cart-intelligence/event/"
  ) {
    return true;
  }
  /**
   * Shopify Admin webhooks (`refunds/create`) — HMAC-verified; no site cookie.
   */
  if (
    pathname === "/api/webhooks/shopify/refunds-create" ||
    pathname === "/api/webhooks/shopify/refunds-create/"
  ) {
    return true;
  }
  if (isProductsApiPath(pathname) || isStorefrontApiPath(pathname)) {
    return true;
  }
  if (/\.(ico|png|jpg|jpeg|gif|svg|webp|woff2?|txt|webmanifest|map|json)$/i.test(pathname)) {
    return true;
  }
  return false;
}

export function middleware(req: NextRequest) {
  if (!isSiteAccessEnforced()) {
    return NextResponse.next();
  }

  if (isPublicPath(req)) {
    return NextResponse.next();
  }

  const role = req.cookies.get(SITE_ACCESS_COOKIE)?.value;
  const isAuthed = isValidSiteAccessRole(role);

  if (!isAuthed) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}
