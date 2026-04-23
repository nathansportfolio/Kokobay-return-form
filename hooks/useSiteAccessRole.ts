"use client";

import { useEffect, useState } from "react";
import {
  getSiteAccessRoleFromDocument,
  type SiteAccessRole,
} from "@/lib/siteAccess";

/**
 * Client-only: current session role from the `site_access` cookie
 * (after PIN sign-in on `/login`).
 */
export function useSiteAccessRole(): SiteAccessRole | null {
  const [role, setRole] = useState<SiteAccessRole | null>(null);
  useEffect(() => {
    setRole(getSiteAccessRoleFromDocument());
  }, []);
  return role;
}
