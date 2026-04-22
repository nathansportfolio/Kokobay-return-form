import type { Metadata } from "next";
import Link from "next/link";
import { OrderReturnLines } from "@/components/OrderReturnLines";
import { getReturnPageLinesAndResume } from "@/lib/returnPageContext";

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
  let loadError: string | null = null;
  try {
    const r = await getReturnPageLinesAndResume(label);
    lines = r.lines;
    resume = r.resume;
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
          .
        </p>
      ) : (
        <OrderReturnLines
          key={`${label}::${resume?.returnUid ?? "new"}`}
          orderLabel={label}
          lines={lines}
          resume={resume}
        />
      )}
    </div>
  );
}
