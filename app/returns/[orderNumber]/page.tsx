import type { Metadata } from "next";
import Link from "next/link";
import { OrderReturnLines } from "@/components/OrderReturnLines";
import { getKokobayOrderLines } from "@/lib/kokobayOrderLines";

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
  const lines = getKokobayOrderLines(label);

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

      {lines.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No lines found for this reference.{" "}
          <Link href="/returns" className="font-medium underline">
            Try another order
          </Link>
          .
        </p>
      ) : (
        <OrderReturnLines key={label} orderLabel={label} lines={lines} />
      )}
    </div>
  );
}
