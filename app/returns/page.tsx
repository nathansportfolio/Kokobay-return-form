import type { Metadata } from "next";
import Link from "next/link";
import { ReturnsOrderForm } from "@/components/ReturnsOrderForm";

/** Server-rendered shell; form is a client island — safe to prerender. */
export const dynamic = "force-static";

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
          We resolve your entry in <strong>Shopify</strong>, then open the return
          screen for that order (name, id, and customer from live order data).
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Return lists">
          <Link
            href="/returns/logged"
            className="inline-flex items-center justify-center rounded-md border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-950 shadow-sm transition-colors hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-100 dark:hover:bg-sky-900/60"
          >
            View all returns
          </Link>
          <Link
            href="/returns/logged?refundPending=1"
            className="inline-flex items-center justify-center rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-950 shadow-sm transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50"
          >
            View outstanding refunds
          </Link>
        </div>
      </div>
      <ReturnsOrderForm />
    </div>
  );
}
