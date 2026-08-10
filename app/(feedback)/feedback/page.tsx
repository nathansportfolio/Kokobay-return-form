import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedbackForm } from "@/components/FeedbackForm";

export const metadata: Metadata = {
  title: { absolute: "FEEDBACK · KOKO BAY" },
  description: "Share your feedback on your KOKO BAY return experience.",
};

export default function FeedbackPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#F7F5F2] text-[#1A1A1A]">
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Suspense
          fallback={
            <p className="text-sm text-[#7A746C]">Loading…</p>
          }
        >
          <FeedbackForm />
        </Suspense>
      </main>
    </div>
  );
}
