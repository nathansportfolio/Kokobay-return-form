"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTopLoader } from "nextjs-toploader";
import { useCallback } from "react";
import { useSiteAccessRole } from "@/hooks/useSiteAccessRole";
import { clearSiteAccessFromBrowser } from "@/lib/siteAccess";

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

  if (
    path === "/orders/today" ||
    path === "/orders/shopify" ||
    path === "/floor-map" ||
    path === "/racking-map" ||
    path === "/products" ||
    path === "/warehouse/racks" ||
    path === "/warehouse/barcodes"
  ) {
    return "/";
  }

  if (path === "/picklists") {
    return "/";
  }
  if (path === "/picklists/today") {
    return "/picklists";
  }
  if (path === "/picklists/uk-premium") {
    return "/picklists";
  }
  if (
    path === "/picklists/today/walk" ||
    path === "/picklists/today/completed" ||
    path === "/picklists/today/print"
  ) {
    const p = new URLSearchParams();
    const o = search.get("ordersPerList");
    if (o) p.set("ordersPerList", o);
    const it = search.get("itemsPerList");
    if (it) p.set("itemsPerList", it);
    const q = p.toString();
    return q ? `/picklists/today?${q}` : "/picklists/today";
  }
  if (
    path === "/picklists/uk-premium/walk" ||
    path === "/picklists/uk-premium/completed" ||
    path === "/picklists/uk-premium/print"
  ) {
    const p = new URLSearchParams();
    const o = search.get("ordersPerList");
    if (o) p.set("ordersPerList", o);
    const it = search.get("itemsPerList");
    if (it) p.set("itemsPerList", it);
    const q = p.toString();
    return q ? `/picklists/uk-premium?${q}` : "/picklists/uk-premium";
  }

  return "/";
}

const CUSTOMER_RETURNS_PATH = "/returns/form";

export function WarehouseShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { start: startTopLoader } = useTopLoader();
  const siteAccessRole = useSiteAccessRole();
  const isHome = pathname === "/";
  const isLogin = pathname === "/login";
  const isBarcodesPage = pathname === "/warehouse/barcodes";
  const isPicklistOrderLabelsPrint =
    pathname === "/picklists/today/print" ||
    pathname === "/picklists/uk-premium/print";
  const isCustomerReturnsForm = pathname === CUSTOMER_RETURNS_PATH;

  const goBack = useCallback(() => {
    const sp =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    const next = getParentHref(pathname, sp);
    startTopLoader();
    requestAnimationFrame(() => {
      router.push(next);
    });
  }, [pathname, router, startTopLoader]);

  const logout = useCallback(() => {
    clearSiteAccessFromBrowser();
    startTopLoader();
    requestAnimationFrame(() => {
      router.push("/login");
      router.refresh();
    });
  }, [router, startTopLoader]);

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

  if (isLogin) {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-center border-b border-zinc-200 bg-background/95 px-4 backdrop-blur dark:border-zinc-800">
          <span className="min-w-0 text-sm font-normal tracking-[0.18em] text-foreground sm:text-base">
            Kokobay Unit
          </span>
        </header>
        <main className="flex min-h-0 flex-1 flex-col items-center sm:pt-4">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header
        className={`sticky top-0 z-30 flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-background/95 px-4 py-1.5 backdrop-blur dark:border-zinc-800${
          isBarcodesPage || isPicklistOrderLabelsPrint ? " print:hidden" : ""
        }`}
      >
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
        <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 py-0.5">
          <Link
            href="/"
            className="text-sm font-normal leading-tight tracking-[0.18em] text-foreground sm:text-base"
          >
            Kokobay Unit
          </Link>
          {siteAccessRole === "admin" ? (
            <span
              className="text-[0.65rem] font-light uppercase leading-none tracking-[0.2em] text-red-600"
              aria-label="Admin session"
            >
              ADMIN
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          {siteAccessRole != null ? (
            <button
              type="button"
              onClick={logout}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Log out
            </button>
          ) : null}
        </div>
      </header>

      <main
        className={
          isBarcodesPage || isPicklistOrderLabelsPrint
            ? "flex min-h-0 flex-1 flex-col print:min-h-0 print:flex-none"
            : "flex min-h-0 flex-1 flex-col"
        }
      >
        {children}
      </main>
    </div>
  );
}
