import type { SiteAccessRole } from "@/lib/siteAccess";

/** Short label for warehouse PIN sessions stored on return logs (no signature). */
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

/** Prefer PIN signature (Helen, KURT, …); else role-based label; else em dash. */
export function warehouseReturnAuditWho(
  operator?: string | null,
  role?: SiteAccessRole | undefined,
): string {
  const o = operator?.trim();
  if (o) return o;
  if (role) return warehouseSiteRoleAuditLabel(role);
  return "—";
}

/** Table / card cell: signature when stored, else legacy digit. */
export function warehouseReturnAuditListCell(
  operator?: string | null,
  role?: SiteAccessRole | undefined,
): string {
  const o = operator?.trim();
  if (o) return o;
  return warehouseSiteRoleAuditDigit(role);
}
