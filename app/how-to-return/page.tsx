import type { Metadata } from "next";
import { HowToReturnPage } from "@/components/HowToReturnPage";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: { absolute: "RETURNS · KOKO BAY" },
  description:
    "Koko Bay returns policy, conditions of return, and how to start a return online via our returns portal.",
};

export default function HowToReturnRoute() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 px-4 pb-24 sm:px-6 sm:pb-32">
      <HowToReturnPage />
    </div>
  );
}
