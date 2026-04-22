import type { Metadata } from "next";
import Link from "next/link";
import { CompletedPicklistsClient } from "@/components/CompletedPicklistsClient";
import { listCompletedPicklistsForDay } from "@/lib/completedPicklist";
import { parseOrdersPerListParam } from "@/lib/fetchTodaysPickLists";
import {
  WAREHOUSE_TZ,
  calendarDateKeyInTz,
  formatDayKeyAsOrdinalEnglish,
} from "@/lib/warehouseLondonDay";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Completed pick lists",
  description: "View and undo pick lists completed today (warehouse day)",
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CompletedPicklistsPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const ordersPerList = parseOrdersPerListParam(sp.ordersPerList);
  const now = new Date();
  const dayKey = calendarDateKeyInTz(now, WAREHOUSE_TZ);

  let rows: Awaited<ReturnType<typeof listCompletedPicklistsForDay>>;
  try {
    rows = await listCompletedPicklistsForDay(dayKey);
  } catch {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Completed pick lists
        </h1>
        <p className="text-sm text-red-600 dark:text-red-400">
          Could not load. Check MongoDB is configured and reachable.
        </p>
      </div>
    );
  }

  const listQuery = new URLSearchParams();
  listQuery.set("ordersPerList", String(ordersPerList));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 pb-12 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Completed pick lists
        </h1>
        <p className="text-sm text-zinc-500">
          <span className="font-medium text-foreground">
            {formatDayKeyAsOrdinalEnglish(dayKey)}
          </span>
        </p>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Orders on this list are hidden from the active “today’s pick lists” page
        until you put them back.
      </p>
      <div className="text-sm">
        <Link
          href={`/picklists/today?${listQuery.toString()}`}
          className="font-medium text-foreground underline"
        >
          ← Today’s pick lists
        </Link>
      </div>
      <CompletedPicklistsClient
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
