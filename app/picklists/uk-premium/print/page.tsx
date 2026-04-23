import type { Metadata } from "next";
import Link from "next/link";
import { PicklistOrderLabelsPrint } from "@/components/picklist/PicklistOrderLabelsPrint";
import { picklistsToLabelPrintBatches } from "@/lib/picklistOrderLabelPrintData";
import {
  fetchUkPremiumPickLists,
  parseOrdersPerListParam,
} from "@/lib/fetchTodaysPickLists";
import { formatDayKeyAsOrdinalEnglish } from "@/lib/warehouseLondonDay";
import { UK_PREMIUM_NDD_LINE_TITLE } from "@/lib/shopifyShippingLineTitles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Next Day — print order labels",
  description:
    "Printable order number and line list for same-day UK Premium (before 2pm) picks",
};

const LIST = "/picklists/uk-premium";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UkPremiumPickListPrintPage({
  searchParams,
}: PageProps) {
  const sp = (await searchParams) ?? {};
  const ordersPerList = parseOrdersPerListParam(sp.ordersPerList);
  const listQuery = new URLSearchParams();
  listQuery.set("ordersPerList", String(ordersPerList));
  const backHref = `${LIST}?${listQuery.toString()}`;

  let payload: Awaited<ReturnType<typeof fetchUkPremiumPickLists>>;
  try {
    payload = await fetchUkPremiumPickLists(ordersPerList);
  } catch {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-xl font-semibold text-foreground">Print order labels</h1>
        <p className="text-sm text-red-600">Could not load pick lists.</p>
      </div>
    );
  }

  const { dayKey, batches, dataSource, ordersPerList: applied } = payload;
  const printBatches = picklistsToLabelPrintBatches(batches);
  const dayOrdinal = formatDayKeyAsOrdinalEnglish(dayKey);
  const documentTitle = `Order labels — ${dayKey} (Next Day)`;

  const noShopify = dataSource === "empty";
  if (noShopify) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-xl font-semibold text-foreground">Print order labels</h1>
        <p className="text-sm text-amber-800 dark:text-amber-200/90">
          UK Premium print labels need Shopify. Configure <code>SHOPIFY_STORE</code>{" "}
          and return here.
        </p>
        <Link href={backHref} className="text-sm font-medium underline">
          Back to Next Day
        </Link>
      </div>
    );
  }

  return (
    <PicklistOrderLabelsPrint
      backHref={backHref}
      backLabel="← Next Day"
      documentTitle={documentTitle}
      pageHeading="Print order labels"
      summaryLine={`Next Day · ${dayOrdinal}, London (before 2pm). Shipping: ${UK_PREMIUM_NDD_LINE_TITLE}. Batching: ${applied} orders per list.`}
      helpLine="Only orders on active Next Day lists, not in a completed special pick yet."
      printBatches={printBatches}
    />
  );
}
