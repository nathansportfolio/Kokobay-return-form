import type { Metadata } from "next";
import Link from "next/link";
import { ReturnsOrderForm } from "@/components/ReturnsOrderForm";

export const metadata: Metadata = {
  title: "Returns",
  description: "Process warehouse returns",
};

export default function ReturnsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Returns
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Enter an order number to start a return or inspection.{" "}
          <Link
            className="font-medium text-foreground underline"
            href="/returns/logged"
          >
            View logged returns
          </Link>
          .
        </p>
      </div>
      <ReturnsOrderForm />
    </div>
  );
}
