import type { Metadata } from "next";
import Link from "next/link";
import { OrderReturnLines } from "@/components/OrderReturnLines";
import {
  getReturnPageLinesAndResume,
  type ReturnPageFormContext,
} from "@/lib/returnPageContext";

type PageProps = {
  params: Promise<{ orderNumber: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { orderNumber } = await params;
  const label = decodeURIComponent(orderNumber);
  return {
    title: `Return · ${label}`,
    description: `Process return for order ${label}`,
  };
}

export default async function OrderReturnPage({ params }: PageProps) {
  const { orderNumber } = await params;
  const label = decodeURIComponent(orderNumber);

  let lines: Awaited<ReturnType<typeof getReturnPageLinesAndResume>>["lines"] =
    [];
  let resume: Awaited<
    ReturnType<typeof getReturnPageLinesAndResume>
  >["resume"] = null;
  let formContext: ReturnPageFormContext = { kind: "noFormOnFile" };
  let loadError: string | null = null;
  try {
    const r = await getReturnPageLinesAndResume(label);
    lines = r.lines;
    resume = r.resume;
    formContext = r.formContext;
  } catch {
    loadError = "Could not load products. Check MongoDB and try again.";
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Order return
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Women&apos;s wear on this order — mark what is coming back and how to
          handle it.
        </p>
      </div>

      {!loadError && formContext.kind === "customerForm" ? (
        <div
          className="rounded-lg border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm dark:border-sky-900/50 dark:bg-sky-950/40"
          role="status"
        >
          <p className="font-medium text-sky-950 dark:text-sky-100">
            Customer return form found
          </p>
          <p className="mt-1.5 text-sky-900/90 dark:text-sky-200/90">
            Lines and reasons below are loaded from their online submission
            (parcel posted {formContext.datePosted}
            {formContext.submittedAtIso
              ? ` · received ${new Date(formContext.submittedAtIso).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" })}`
              : null}
            ). {formContext.customerName} · {formContext.customerEmail}
          </p>
        </div>
      ) : null}

      {!loadError && formContext.kind === "noFormOnFile" && lines.length > 0 ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30"
          role="status"
        >
          <p className="font-medium text-amber-950 dark:text-amber-100">
            No customer return form on file
          </p>
        </div>
      ) : null}

      {loadError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      ) : lines.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No products in the database for returns.{" "}
          <span className="text-zinc-500">
            Post to{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              /api/warehouse/seed-mock-products
            </code>{" "}
            to seed the catalog, or{" "}
          </span>
          <Link href="/returns" className="font-medium underline">
            try another order
          </Link>
          .{" "}
          {!loadError && formContext.kind === "noFormOnFile" ? (
            <span className="block pt-2 text-zinc-500">
              No customer return form for this order was found either.
            </span>
          ) : null}
        </p>
      ) : (
        <OrderReturnLines
          key={`${label}::${resume?.returnUid ?? resume?.customerFormSubmissionUid ?? "new"}`}
          orderLabel={label}
          lines={lines}
          resume={resume}
        />
      )}
    </div>
  );
}
