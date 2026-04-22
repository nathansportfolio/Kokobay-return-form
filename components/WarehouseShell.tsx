"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * One step up the app hierarchy (not the browser history stack), until home.
 */
function getParentHref(pathname: string, search: URLSearchParams): string {
  const path =
    pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;

  if (path === "" || path === "/") {
    return "/";
  }

  if (/^\/returns\/[^/]+$/.test(path) && path !== "/returns") {
    return "/returns";
  }
  if (path === "/returns") {
    return "/";
  }

  if (path === "/orders/today" || path === "/floor-map") {
    return "/";
  }

  if (path === "/picklists") {
    return "/";
  }
  if (path === "/picklists/today") {
    return "/picklists";
  }
  if (path === "/picklists/today/walk" || path === "/picklists/today/completed") {
    const p = new URLSearchParams();
    const o = search.get("ordersPerList");
    if (o) p.set("ordersPerList", o);
    const q = p.toString();
    return q ? `/picklists/today?${q}` : "/picklists/today";
  }

  return "/";
}

const CUSTOMER_RETURNS_PATH = "/returns/form";

export function WarehouseShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";
  const isCustomerReturnsForm = pathname === CUSTOMER_RETURNS_PATH;

  const goBack = useCallback(() => {
    const sp =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    const next = getParentHref(pathname, sp);
    router.push(next);
  }, [pathname, router]);

  if (isCustomerReturnsForm) {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-zinc-200 bg-background/95 px-4 backdrop-blur dark:border-zinc-800">
          <span className="min-w-0 text-sm font-normal tracking-[0.18em] text-foreground sm:text-base">
            KOKO BAY RETURNS
          </span>
        </header>
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-background/95 px-4 backdrop-blur dark:border-zinc-800">
        <div className="flex min-w-0 flex-1 items-center justify-start">
          {!isHome ? (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              aria-label="Back"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </button>
          ) : null}
        </div>
        <div className="shrink-0">
          <Link
            href="/"
            className="text-sm font-normal tracking-[0.18em] text-foreground sm:text-base"
          >
            Kokobay Unit
          </Link>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
