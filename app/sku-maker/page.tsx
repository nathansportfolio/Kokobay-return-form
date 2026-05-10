import type { Metadata } from "next";
import { Suspense } from "react";
import { SkuMakerClient } from "@/components/sku-maker/SkuMakerClient";

export const metadata: Metadata = {
  title: "SKU Maker",
  description:
    "Search any Shopify product (drafts included) and generate canonical SKUs for each variant — automatically deduped against the rest of the shop.",
};

export const dynamic = "force-dynamic";

function SkuMakerLoading() {
  return (
    <div
      className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6"
      role="status"
      aria-label="Loading SKU Maker"
    >
      <div className="animate-pulse">
        <div className="h-8 w-56 max-w-full rounded-md bg-zinc-200/90 dark:bg-zinc-800/80" />
        <div className="mt-2 h-4 w-full max-w-md rounded bg-zinc-200/70 dark:bg-zinc-800/50" />
        <div className="mt-8 h-10 w-full max-w-xl rounded-lg bg-zinc-200/60 dark:bg-zinc-800/50" />
      </div>
    </div>
  );
}

export default function SkuMakerPage() {
  return (
    <Suspense fallback={<SkuMakerLoading />}>
      <SkuMakerClient />
    </Suspense>
  );
}
