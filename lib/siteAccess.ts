/** HttpOnly is not set from client `document.cookie`; name reused by middleware. */
export const SITE_ACCESS_COOKIE = "site_access";

export type SiteAccessRole = "user" | "admin";

export function isValidSiteAccessRole(
  v: string | null | undefined,
): v is SiteAccessRole {
  return v === "user" || v === "admin";
}

/** Whether PIN gate is on (at least one public PIN env is non-empty). */
export function isSiteAccessEnforced(): boolean {
  const u = String(process.env.NEXT_PUBLIC_SITE_PIN_USER ?? "").trim();
  const a = String(process.env.NEXT_PUBLIC_SITE_PIN_ADMIN ?? "").trim();
  return u.length > 0 || a.length > 0;
}

/** Parse `document.cookie` in the browser. */
export function getSiteAccessRoleFromDocument(): SiteAccessRole | null {
  if (typeof document === "undefined") {
    return null;
  }
  return parseSiteAccessFromCookieString(document.cookie);
}

/** Client-only: clear session cookies (new + legacy), same path as login. */
export function clearSiteAccessFromBrowser(): void {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${SITE_ACCESS_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = "auth=; path=/; max-age=0";
}

function parseSiteAccessFromCookieString(cookie: string): SiteAccessRole | null {
  for (const part of cookie.split(";")) {
    const t = part.trim();
    if (!t.startsWith(`${SITE_ACCESS_COOKIE}=`)) {
      continue;
    }
    const v = t.slice(SITE_ACCESS_COOKIE.length + 1);
    if (isValidSiteAccessRole(v)) {
      return v;
    }
  }
  return null;
}

/** Parse `Cookie` request header (Route Handlers / middleware). */
export function parseSiteAccessRoleFromCookieHeader(
  cookieHeader: string | null | undefined,
): SiteAccessRole | null {
  if (cookieHeader == null || cookieHeader === "") return null;
  return parseSiteAccessFromCookieString(cookieHeader);
}
