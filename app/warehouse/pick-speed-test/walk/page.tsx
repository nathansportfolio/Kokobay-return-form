import type { Metadata } from "next";
import Link from "next/link";
import { PicklistWalkClient } from "@/components/PicklistWalkClient";
import {
  enrichShopifyOrdersAsOrderForPick,
  fetchShopifyOrdersByIdsForSpeedTest,
  isShopifyWarehouseDataEnabled,
} from "@/lib/shopifyWarehouseDayOrders";
import {
  buildAssemblyFromOrders,
  buildSortedStepsFromOrders,
} from "@/lib/picklistStepsFromOrders";
import {
  clampItemsPerList,
  clampOrdersPerList,
  parseItemsPerListParam,
  parseOrdersPerListParam,
} from "@/lib/picklistShared";
import { PICKLIST_LIST_KIND_STANDARD } from "@/lib/picklistListKind";
import { withPickableLinesOnly } from "@/lib/warehousePickableLine";
import { getTodayCalendarDateKeyInLondon } from "@/lib/warehouseLondonDay";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pick speed test — walk",
  description: "Batched pick walk for timing comparison (no server save)",
};

const SPEED_TEST_MAX_IDS = 50;

function parseIdsParam(raw: string | string[] | undefined): number[] {
  const s = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  if (!s) return [];
  const out: number[] = [];
  for (const part of s.split(/[\s,]+/u)) {
    const n = parseInt(part.trim(), 10);
    if (Number.isFinite(n) && n > 0) out.push(n);
    if (out.length >= SPEED_TEST_MAX_IDS) break;
  }
  return [...new Set(out)];
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PickSpeedTestWalkPage({
  searchParams,
}: PageProps) {
  const sp = (await searchParams) ?? {};
  const ids = parseIdsParam(sp.ids);
  const ordersPerList = clampOrdersPerList(parseOrdersPerListParam(sp.ordersPerList));
  const itemsPerList = clampItemsPerList(parseItemsPerListParam(sp.itemsPerList));

  const hubQuery = new URLSearchParams();
  hubQuery.set("ids", ids.join(","));
  const hubHref = `/warehouse/pick-speed-test?${hubQuery.toString()}`;

  if (!isShopifyWarehouseDataEnabled()) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-xl font-semibold text-foreground">Speed test walk</h1>
        <p className="text-sm text-red-600 dark:text-red-400">
          Shopify is not configured.
        </p>
        <Link href="/warehouse/pick-speed-test" className="text-sm underline">
          Back
        </Link>
      </div>
    );
  }

  if (ids.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-xl font-semibold text-foreground">Speed test walk</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Missing <span className="font-mono">ids</span> query (Shopify order
          ids). Open the walk from the speed test page.
        </p>
        <Link href="/warehouse/pick-speed-test" className="text-sm underline">
          Pick speed test
        </Link>
      </div>
    );
  }

  const raw = await fetchShopifyOrdersByIdsForSpeedTest(ids);
  const enriched = await enrichShopifyOrdersAsOrderForPick(raw, {
    logEachPickItem: true,
  });
  const orders = withPickableLinesOnly(enriched);

  if (orders.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-xl font-semibold text-foreground">Speed test walk</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No pickable lines for these orders (after filtering shipping-only
          lines). Check the flat list on the speed test page.
        </p>
        <Link href={hubHref} className="text-sm underline">
          Back to speed test
        </Link>
      </div>
    );
  }

  const steps = buildSortedStepsFromOrders(orders);
  const assembly = buildAssemblyFromOrders(orders);
  const dayKey = getTodayCalendarDateKeyInLondon();

  if (steps.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-xl font-semibold text-foreground">Speed test walk</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Pick steps could not be built for this set.
        </p>
        <Link href={hubHref} className="text-sm underline">
          Back to speed test
        </Link>
      </div>
    );
  }

  return (
    <PicklistWalkClient
      steps={steps}
      pickListNumber={1}
      orderNumbers={orders.map((o) => o.orderNumber)}
      batchOrders={orders}
      ordersPerList={ordersPerList}
      itemsPerList={itemsPerList}
      dayKey={dayKey}
      assembly={assembly}
      listPathBase="/warehouse/pick-speed-test"
      listKind={PICKLIST_LIST_KIND_STANDARD}
      submitPickCompleteToServer={false}
      enablePauseMissingStock={false}
      listUrlSearchParams={{ ids: ids.join(",") }}
    />
  );
}
