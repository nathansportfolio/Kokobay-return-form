import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isValidProductsApiKeyNextRequest } from "@/lib/kokobayProductsApiKey";
import {
  isValidSiteAccessRole,
  isSiteAccessEnforced,
  SITE_ACCESS_COOKIE,
} from "@/lib/siteAccess";

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
   * Product JSON proxies — require `x-kokobay-products-api-key` (or Bearer) so unauthenticated
   * callers (e.g. mobile) can use the API without the PIN cookie.
   */
  if (pathname === "/api/products" && isValidProductsApiKeyNextRequest(req)) {
    return true;
  }
  if (
    /^\/api\/products\/[0-9]+\/?$/.test(pathname) &&
    isValidProductsApiKeyNextRequest(req)
  ) {
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
