import type { Metadata } from "next";
import { Suspense } from "react";
import { BarcodesClient } from "@/components/barcode/BarcodesClient";

export const metadata: Metadata = {
  title: "Barcode labels",
  description: "Print CODE128 labels for bin locations and product SKUs",
};

function BarcodesLoading() {
  return (
    <div className="mx-auto max-w-4xl flex-1 p-4 sm:p-6">
      <p className="text-sm text-zinc-500">Loading…</p>
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
