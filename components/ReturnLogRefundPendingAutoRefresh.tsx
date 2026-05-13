"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const INTERVAL_MS = 3000;

/**
 * Calls `router.refresh()` on an interval so the server RSC re-fetches return
 * rows (Shopify payment / greyed state, refund flags) without a full navigation.
 */
export function ReturnLogRefundPendingAutoRefresh() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    const id = window.setInterval(() => {
      routerRef.current.refresh();
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
