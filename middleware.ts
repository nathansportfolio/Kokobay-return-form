import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isValidSiteAccessRole,
  isSiteAccessEnforced,
  SITE_ACCESS_COOKIE,
} from "@/lib/siteAccess";

/**
 * Product JSON proxies — skip PIN cookie so mobile / curl can hit them.
 * Routes are unauthenticated; Shopify Admin credentials stay server-only.
 */
function isProductsApiPath(pathname: string): boolean {
  if (pathname === "/api/products" || pathname === "/api/products/") {
    return true;
  }
  return /^\/api\/products\/[0-9]+\/?$/.test(pathname);
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
  if (isProductsApiPath(pathname)) {
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
