"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/orders/today", label: "Today’s orders" },
  { href: "/picklists/today", label: "Today’s pick lists" },
  { href: "/picklists", label: "Picklists" },
  { href: "/returns", label: "Returns" },
] as const;

export function WarehouseShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-background/95 px-4 backdrop-blur dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="warehouse-nav"
            aria-label="Open menu"
          >
            <span className="sr-only">Open menu</span>
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-foreground sm:text-base"
          >
            Kokobay Warehouse
          </Link>
        </div>
      </header>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 dark:bg-black/60"
          aria-label="Close menu"
          onClick={close}
        />
      ) : null}

      <aside
        id="warehouse-nav"
        className={`fixed left-0 top-0 z-50 flex h-full w-[min(18rem,88vw)] flex-col border-r border-zinc-200 bg-background pt-14 shadow-xl transition-transform duration-200 ease-out dark:border-zinc-800 ${
          open ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        <nav className="flex flex-col gap-1 p-3" aria-label="Main navigation">
          {NAV.map(({ href, label }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-zinc-200 text-foreground dark:bg-zinc-800"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
