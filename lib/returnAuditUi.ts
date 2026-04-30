import type { SiteAccessRole } from "@/lib/siteAccess";

/** Short label for warehouse PIN sessions stored on return logs. */
export function warehouseSiteRoleAuditLabel(role: SiteAccessRole): string {
  return role === "admin" ? "Admin session" : "Team session";
}

/**
 * Compact PIN id for lists: **1** = team (`user`), **2** = admin (`admin`).
 * Returns em dash when unknown (legacy rows or missing cookie).
 */
export function warehouseSiteRoleAuditDigit(
  role: SiteAccessRole | undefined,
): string {
  if (role === "admin") return "2";
  if (role === "user") return "1";
  return "—";
}
