import type { Metadata } from "next";
import { PicklistOrderLabelsPrint } from "@/components/picklist/PicklistOrderLabelsPrint";
import {
  fetchTodaysPickLists,
  parseItemsPerListParam,
  parseOrdersPerListParam,
} from "@/lib/fetchTodaysPickLists";
import { picklistsToLabelPrintBatches } from "@/lib/picklistOrderLabelPrintData";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Print order labels (today’s pick lists)",
  description:
    "Printable order number and line list for the standard pick list day",
};

const LIST = "/picklists/today";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TodaysPickListPrintPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const ordersPerList = parseOrdersPerListParam(sp.ordersPerList);
  const itemsPerList = parseItemsPerListParam(sp.itemsPerList);
  const listQuery = new URLSearchParams();
  listQuery.set("ordersPerList", String(ordersPerList));
  listQuery.set("itemsPerList", String(itemsPerList));
  const backHref = `${LIST}?${listQuery.toString()}`;

  let payload: Awaited<ReturnType<typeof fetchTodaysPickLists>>;
  try {
    payload = await fetchTodaysPickLists(ordersPerList, itemsPerList);
  } catch {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-xl font-semibold text-foreground">Print order labels</h1>
        <p className="text-sm text-red-600">Could not load pick lists.</p>
      </div>
    );
  }

  const { dayKey, batches, ordersPerList: applied } = payload;
  const printBatches = picklistsToLabelPrintBatches(batches);
  const documentTitle = `Order labels — ${dayKey} (standard)`;

  return (
    <PicklistOrderLabelsPrint
      backHref={backHref}
      backLabel="← Today’s pick lists"
      documentTitle={documentTitle}
      pageHeading="Print order labels"
      summaryLine={`One block per order, in pick list and line order · batching: ${applied} orders per list.`}
      helpLine="Use this to label packages after picking. Only orders on the current active pick lists are listed (not already completed today)."
      printBatches={printBatches}
    />
  );
}
