import type { Metadata } from "next";
import { Suspense } from "react";
import { CartIntelligenceClient } from "@/components/cart-intelligence/CartIntelligenceClient";

export const metadata: Metadata = {
  title: "Cart Intelligence",
  description:
    "Abandonment rates by stock-level cohort (low-stock, last-one, normal) from the Shopify Custom Pixel.",
};

export const dynamic = "force-dynamic";

function CartIntelligenceLoading() {
  return (
    <div
      className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6"
      role="status"
      aria-label="Loading Cart Intelligence dashboard"
    >
      <div className="animate-pulse">
        <div className="h-8 w-64 max-w-full rounded-md bg-zinc-200/90 dark:bg-zinc-800/80" />
        <div className="mt-2 h-4 w-full max-w-md rounded bg-zinc-200/70 dark:bg-zinc-800/50" />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-32 w-full rounded-xl border border-zinc-100/80 bg-zinc-100/35 dark:border-zinc-800/70 dark:bg-zinc-900/40"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CartIntelligencePage() {
  return (
    <Suspense fallback={<CartIntelligenceLoading />}>
      <CartIntelligenceClient />
    </Suspense>
  );
}
