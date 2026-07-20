"use client";

import type { ComponentType } from "react";
import {
  ChartLine,
  CurrencyGbp,
  HandCoins,
  ListChecks,
  SignOut,
  Tag,
  User,
  X,
} from "@phosphor-icons/react";
import type { AffiliateNavId } from "@/lib/affiliate/types";

const NAV: {
  id: AffiliateNavId;
  label: string;
  icon: ComponentType<{ className?: string; weight?: "duotone" | "fill" }>;
}[] = [
  { id: "dashboard", label: "Dashboard", icon: ChartLine },
  { id: "clicks", label: "Clicks", icon: ChartLine },
  { id: "codeUsage", label: "Code Usage", icon: Tag },
  { id: "orders", label: "Orders", icon: ListChecks },
  { id: "earnings", label: "Earnings", icon: CurrencyGbp },
  { id: "payments", label: "Payments", icon: HandCoins },
  { id: "profile", label: "Profile", icon: User },
];

export function AffiliateSidebar({
  active,
  onNavigate,
  onLogout,
  mobileOpen,
  onCloseMobile,
}: {
  active: AffiliateNavId;
  onNavigate: (id: AffiliateNavId) => void;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const nav = (
    <nav className="flex h-full flex-col" aria-label="Affiliate">
      <div className="flex items-center justify-between px-5 pb-6 pt-7">
        <p className="text-lg tracking-[0.18em] text-[#1A1A1A]">KOKO BAY</p>
        <button
          type="button"
          className="rounded-lg p-2 text-[#6B6560] lg:hidden"
          onClick={onCloseMobile}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <ul className="flex flex-1 flex-col gap-1 px-3">
        {NAV.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => {
                  onNavigate(id);
                  onCloseMobile();
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-[#F5D0D0]/90 text-[#1A1A1A]"
                    : "text-[#5C574F] hover:bg-[#F3EEE8]"
                }`}
              >
                <Icon
                  className="h-5 w-5 shrink-0"
                  weight={isActive ? "fill" : "duotone"}
                />
                <span>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="px-3 pb-6 pt-4">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm text-[#5C574F] transition-colors hover:bg-[#F3EEE8]"
        >
          <SignOut className="h-5 w-5 shrink-0" weight="duotone" />
          Log out
        </button>
      </div>
    </nav>
  );

  return (
    <>
      <aside className="hidden w-56 shrink-0 border-r border-[#EBE6E0] bg-[#FBF9F7] lg:block">
        {nav}
      </aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/25"
            aria-label="Close menu overlay"
            onClick={onCloseMobile}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(18rem,88vw)] bg-[#FBF9F7] shadow-xl">
            {nav}
          </aside>
        </div>
      ) : null}
    </>
  );
}
