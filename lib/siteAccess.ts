/** HttpOnly is not set from client `document.cookie`; name reused by middleware. */
export const SITE_ACCESS_COOKIE = "site_access";

/** Set at login with the warehouse person’s display name (see `matchWarehousePinToSession`). */
export const WAREHOUSE_OPERATOR_COOKIE = "warehouse_operator";

export type SiteAccessRole = "user" | "admin";

export function isValidSiteAccessRole(
  v: string | null | undefined,
): v is SiteAccessRole {
  return v === "user" || v === "admin";
}

/** Whether PIN gate is on (at least one public PIN env is non-empty). */
export function isSiteAccessEnforced(): boolean {
  if (
    String(process.env.NEXT_PUBLIC_SITE_PIN_USER ?? "").trim() ||
    String(process.env.NEXT_PUBLIC_SITE_PIN_ADMIN ?? "").trim()
  ) {
    return true;
  }
  for (const k of [
    "NEXT_PUBLIC_SITE_PIN_USER_1",
    "NEXT_PUBLIC_SITE_PIN_USER_2",
    "NEXT_PUBLIC_SITE_PIN_USER_3",
    "NEXT_PUBLIC_SITE_PIN_USER_4",
  ] as const) {
    if (String(process.env[k] ?? "").trim()) return true;
  }
  return false;
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
  document.cookie = `${WAREHOUSE_OPERATOR_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
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

function parseCookieValue(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const t = part.trim();
    if (!t.startsWith(`${name}=`)) continue;
    return t.slice(name.length + 1);
  }
  return null;
}

/** Decode a single `warehouse_operator` cookie value (from `cookies().get(...).value`). */
export function parseWarehouseOperatorLabelFromEncodedValue(
  encoded: string | null | undefined,
): string | null {
  if (encoded == null || encoded === "") return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

/** Warehouse display name from login PIN mapping (`warehouse_operator` cookie). */
export function parseWarehouseOperatorLabelFromCookieHeader(
  cookieHeader: string | null | undefined,
): string | null {
  if (cookieHeader == null || cookieHeader === "") return null;
  const raw = parseCookieValue(cookieHeader, WAREHOUSE_OPERATOR_COOKIE);
  return parseWarehouseOperatorLabelFromEncodedValue(raw);
}
