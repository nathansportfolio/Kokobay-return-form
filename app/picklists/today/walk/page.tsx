import type { Metadata } from "next";
import Link from "next/link";
import { PicklistWalkClient } from "@/components/PicklistWalkClient";
import {
  fetchTodaysPickLists,
  parseOrdersPerListParam,
} from "@/lib/fetchTodaysPickLists";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Walk pick list",
  description: "Step through today’s pick list one stop at a time",
};

function parseListParam(
  raw: string | string[] | undefined,
): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(String(s ?? "1"), 10);
  if (Number.isNaN(n) || n < 1) return 1;
  return n;
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PicklistWalkPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const ordersPerList = parseOrdersPerListParam(sp.ordersPerList);
  const listN = parseListParam(sp.list);

  let payload: Awaited<ReturnType<typeof fetchTodaysPickLists>>;
  try {
    payload = await fetchTodaysPickLists(ordersPerList);
  } catch {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-xl font-semibold text-foreground">Walk pick list</h1>
        <p className="text-sm text-red-600 dark:text-red-400">
          Could not load data. Check MongoDB is configured and reachable.
        </p>
        <Link
          href="/picklists/today"
          className="text-sm font-medium text-foreground underline"
        >
          Back to pick lists
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
        <h1 className="text-xl font-semibold text-foreground">Walk pick list</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This pick list was not found or has no stops. It may not exist for the
          current batching setting.
        </p>
        <Link
          href={`/picklists/today?${listQuery.toString()}`}
          className="text-sm font-medium text-foreground underline"
        >
          Back to pick lists
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
    />
  );
}
