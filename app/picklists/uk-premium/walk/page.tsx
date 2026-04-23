import type { Metadata } from "next";
import Link from "next/link";
import { PicklistWalkClient } from "@/components/PicklistWalkClient";
import { PICKLIST_LIST_KIND_UK_PREMIUM } from "@/lib/picklistListKind";
import { fetchUkPremiumPickLists, parseOrdersPerListParam } from "@/lib/fetchTodaysPickLists";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Next Day — walk list",
  description: "Step through a Next Day (UK Premium) pick list",
};

const LIST = "/picklists/uk-premium";

function parseListParam(raw: string | string[] | undefined): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(String(s ?? "1"), 10);
  if (Number.isNaN(n) || n < 1) return 1;
  return n;
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UkPremiumWalkPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const ordersPerList = parseOrdersPerListParam(sp.ordersPerList);
  const listN = parseListParam(sp.list);

  let payload: Awaited<ReturnType<typeof fetchUkPremiumPickLists>>;
  try {
    payload = await fetchUkPremiumPickLists(ordersPerList);
  } catch {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-xl font-semibold text-foreground">Walk pick list</h1>
        <p className="text-sm text-red-600">Could not load. Check SHOPIFY_ env and Mongo.</p>
        <Link href={LIST} className="text-sm font-medium text-foreground underline">
          Back
        </Link>
      </div>
    );
  }

  const { batches, ordersPerList: applied, dayKey } = payload;
  const batch = batches.find((b) => b.batchIndex === listN);

  if (!batch || batch.steps.length === 0) {
    const listQuery = new URLSearchParams();
    listQuery.set("ordersPerList", String(applied));
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-xl font-semibold">Walk pick list</h1>
        <p className="text-sm text-zinc-500">
          This list was not found or has no stops, or this flow is disabled (no
          Shopify).
        </p>
        <Link
          href={`${LIST}?${listQuery.toString()}`}
          className="text-sm font-medium text-foreground underline"
        >
          Back
        </Link>
      </div>
    );
  }

  return (
    <PicklistWalkClient
      steps={batch.steps}
      pickListNumber={batch.displayPickListNumber}
      orderNumbers={batch.orderNumbers}
      ordersPerList={applied}
      dayKey={dayKey}
      assembly={batch.assembly}
      listPathBase={LIST}
      listKind={PICKLIST_LIST_KIND_UK_PREMIUM}
    />
  );
}
