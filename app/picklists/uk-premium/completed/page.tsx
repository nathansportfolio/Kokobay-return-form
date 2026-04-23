import type { Metadata } from "next";
import Link from "next/link";
import { CompletedPicklistsClient } from "@/components/CompletedPicklistsClient";
import { listCompletedPicklistsForDay } from "@/lib/completedPicklist";
import { parseOrdersPerListParam } from "@/lib/fetchTodaysPickLists";
import { PICKLIST_LIST_KIND_UK_PREMIUM } from "@/lib/picklistListKind";
import {
  formatDayKeyAsOrdinalEnglish,
  getTodayCalendarDateKeyInLondon,
} from "@/lib/warehouseLondonDay";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Next Day — completed",
  description: "View and undo UK Premium (NDD) pick lists for the London work day",
};

const LIST = "/picklists/uk-premium";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UkPremiumCompletedPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const ordersPerList = parseOrdersPerListParam(sp.ordersPerList);
  const dayKey = getTodayCalendarDateKeyInLondon();

  let rows: Awaited<ReturnType<typeof listCompletedPicklistsForDay>>;
  try {
    rows = await listCompletedPicklistsForDay(dayKey, PICKLIST_LIST_KIND_UK_PREMIUM);
  } catch {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold">Next Day — completed</h1>
        <p className="mt-2 text-sm text-red-600">Could not load. Check MongoDB.</p>
      </div>
    );
  }

  const listQuery = new URLSearchParams();
  listQuery.set("ordersPerList", String(ordersPerList));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 pb-12 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Next Day — completed</h1>
        <p className="mt-1 text-sm text-zinc-500">
          <span className="font-medium text-foreground">
            {formatDayKeyAsOrdinalEnglish(dayKey)}
          </span>{" "}
          (same London work day, before 2pm NDD)
        </p>
      </div>
      <p className="text-sm text-zinc-600">
        These orders are hidden from the active Next Day list until you “put
        back” here.
      </p>
      <p className="text-sm">
        <Link href={`${LIST}?${listQuery.toString()}`} className="font-medium underline">
          ← Next Day
        </Link>
        {" · "}
        <Link href="/picklists" className="font-medium underline">
          All types
        </Link>
      </p>
      <CompletedPicklistsClient
        listPathBase={LIST}
        ordersPerList={ordersPerList}
        rows={rows.map((r) => ({
          picklistUid: r.picklistUid,
          batchIndex: r.batchIndex,
          ordersPerList: r.ordersPerList,
          orderNumbers: r.orderNumbers,
          orderCount: r.orderCount,
          totalItemsQty: r.totalItemsQty,
          stopCount: r.stopCount,
          completedAt: r.completedAt,
        }))}
      />
    </div>
  );
}
