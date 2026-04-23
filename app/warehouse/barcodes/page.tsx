import type { Metadata } from "next";
import { Suspense } from "react";
import { BarcodesClient } from "@/components/barcode/BarcodesClient";

export const metadata: Metadata = {
  title: "Barcode labels",
  description: "Print CODE128 labels for bin locations and product SKUs",
};

function BarcodesLoading() {
  return (
    <div
      className="mx-auto max-w-4xl flex-1 p-4 sm:p-6"
      role="status"
      aria-label="Loading page"
    >
      <div className="animate-pulse">
        <div className="h-8 w-56 max-w-full rounded-md bg-zinc-200/90 dark:bg-zinc-800/80" />
        <div className="mt-2 h-4 w-full max-w-md rounded bg-zinc-200/70 dark:bg-zinc-800/50" />
        <div className="mt-8 h-10 w-full max-w-xl rounded-lg bg-zinc-200/60 dark:bg-zinc-800/50" />
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-14 w-full rounded-lg border border-zinc-100/80 bg-zinc-100/35 dark:border-zinc-800/70 dark:bg-zinc-900/40"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BarcodesPage() {
  return (
    <Suspense fallback={<BarcodesLoading />}>
      <BarcodesClient />
    </Suspense>
  );
}
