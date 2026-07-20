import type { Metadata } from "next";
import { Suspense } from "react";
import { AffiliateApp } from "@/components/affiliate/AffiliateApp";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: { absolute: "AFFILIATE · KOKO BAY" },
  description: "KOKO BAY affiliate portal — track clicks, code usage, and earnings.",
};

export default function AffiliatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full flex-1 items-center justify-center bg-[#F7F5F2] text-sm text-[#7A746C]">
          Loading…
        </div>
      }
    >
      <AffiliateApp />
    </Suspense>
  );
}
