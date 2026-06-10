import type { Metadata } from "next";

import { TrackOrderForm } from "@/components/TrackOrderForm";
import { TRACK_ORDER_PAGE_COPY } from "@/lib/trackOrderPageContent";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: { absolute: "TRACK ORDER · KOKO BAY" },
  description: TRACK_ORDER_PAGE_COPY.intro,
};

export default function TrackOrderPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 px-4 pt-4 pb-24 sm:px-6 sm:pt-6 sm:pb-32">
      <TrackOrderForm />
    </div>
  );
}
