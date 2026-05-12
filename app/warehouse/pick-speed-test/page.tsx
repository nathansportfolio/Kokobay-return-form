import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchLatestShopifyOrdersForSpeedTest,
  fetchShopifyOrdersByIdsForSpeedTest,
  isShopifyWarehouseDataEnabled,
  displayCustomerNameParts,
} from "@/lib/shopifyWarehouseDayOrders";
import { clampOrdersPerList } from "@/lib/picklistShared";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pick speed test",
  description:
    "Compare one-by-one order picking vs batched pick walk (training only)",
};

const SPEED_TEST_MAX_ORDERS = 50;
const DEFAULT_COUNT = 8;

function parseCountParam(
  raw: string | string[] | undefined,
): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(String(s ?? ""), 10);
  if (Number.isNaN(n)) return DEFAULT_COUNT;
  return Math.min(
    SPEED_TEST_MAX_ORDERS,
    Math.max(1, Math.floor(n)),
  );
}

function parseIdsParam(raw: string | string[] | undefined): number[] {
  const s = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  if (!s) return [];
  const out: number[] = [];
  for (const part of s.split(/[\s,]+/u)) {
    const n = parseInt(part.trim(), 10);
    if (Number.isFinite(n) && n > 0) out.push(n);
    if (out.length >= SPEED_TEST_MAX_ORDERS) break;
  }
  return [...new Set(out)];
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PickSpeedTestPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const idList = parseIdsParam(sp.ids);
  const count = parseCountParam(sp.count);

  if (!isShopifyWarehouseDataEnabled()) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-xl font-semibold text-foreground">Pick speed test</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Shopify is not configured for this environment (
          <span className="font-mono">SHOPIFY_STORE</span>
          ). This page needs live order data from Admin API.
        </p>
        <Link
          href="/picklists"
          className="text-sm font-medium text-foreground underline"
        >
          Back to picklists
        </Link>
      </div>
    );
  }

  const rawOrders =
    idList.length > 0
      ? await fetchShopifyOrdersByIdsForSpeedTest(idList)
      : await fetchLatestShopifyOrdersForSpeedTest(count);

  for (const o of rawOrders) {
    for (const li of o.line_items ?? []) {
      if ((li.quantity ?? 0) <= 0) continue;
      // eslint-disable-next-line no-console -- speed test hub: inspect raw lines
      console.log("[speed test shopify line]", o.name, {
        lineItemId: li.id,
        title: li.title,
        variant_title: li.variant_title,
        sku: li.sku,
        quantity: li.quantity,
        requires_shipping: li.requires_shipping,
        price: li.price,
      });
    }
  }

  const walkQuery = new URLSearchParams();
  if (rawOrders.length > 0) {
    walkQuery.set("ids", rawOrders.map((o) => o.id).join(","));
    walkQuery.set(
      "ordersPerList",
      String(clampOrdersPerList(rawOrders.length)),
    );
    walkQuery.set("itemsPerList", "100");
  }
  const walkHref =
    rawOrders.length > 0
      ? `/warehouse/pick-speed-test/walk?${walkQuery.toString()}`
      : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Pick speed test
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Load the same set of Shopify orders twice: one person follows the
          flat list below (order by order); another opens the batched pick walk.
          Finishing the walk does not write completed picklists or pauses.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40 sm:flex-row sm:items-end sm:justify-between">
        <form
          method="get"
          action="/warehouse/pick-speed-test"
          className="flex flex-col gap-2 sm:flex-1"
        >
          <label className="text-sm font-medium text-foreground">
            Latest orders (count)
            <input
              name="count"
              type="number"
              min={1}
              max={SPEED_TEST_MAX_ORDERS}
              defaultValue={count}
              className="mt-1 block w-full max-w-[12rem] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </label>
          <p className="text-xs text-zinc-500">
            Uses most recent by created date (1–{SPEED_TEST_MAX_ORDERS}).
          </p>
          <button
            type="submit"
            className="mt-1 inline-flex max-w-xs items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-amber-500 dark:text-amber-950"
          >
            Load latest
          </button>
        </form>

        {idList.length > 0 ? (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Showing{" "}
            <span className="font-medium text-foreground">
              {rawOrders.length}
            </span>{" "}
            of {idList.length} requested ids.{" "}
            <Link
              href={`/warehouse/pick-speed-test?count=${count}`}
              className="font-medium text-sky-800 underline dark:text-sky-300"
            >
              Switch to latest orders (clear ids)
            </Link>
          </p>
        ) : null}
      </div>

      {rawOrders.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No orders returned. Try a smaller set or check Shopify credentials.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-foreground">
              One-by-one list ({rawOrders.length} orders)
            </p>
            {walkHref ? (
              <Link
                href={walkHref}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500"
              >
                Open batched pick walk (same orders)
              </Link>
            ) : null}
          </div>

          <ol className="list-decimal space-y-6 border-t border-zinc-200 pt-4 pl-5 dark:border-zinc-700">
            {rawOrders.map((o) => {
              const { firstName, lastName } = displayCustomerNameParts(o);
              const customer =
                [firstName, lastName].filter(Boolean).join(" ") || "—";
              const lines = (o.line_items ?? []).filter(
                (li) => (li.quantity ?? 0) > 0,
              );
              return (
                <li key={o.id} className="text-sm text-foreground">
                  <div className="font-semibold">
                    <span className="font-mono">{o.name}</span>
                    <span className="ml-2 text-zinc-500">
                      · id {o.id} · {customer}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {new Date(o.created_at).toLocaleString("en-GB", {
                      timeZone: "Europe/London",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    · {o.financial_status ?? "—"}
                  </p>
                  <ul className="mt-2 list-none space-y-1 p-0 text-zinc-700 dark:text-zinc-300">
                    {lines.map((li) => (
                      <li key={li.id} className="text-xs">
                        <span className="font-mono tabular-nums">
                          ×{li.quantity}
                        </span>{" "}
                        {li.title}
                        {li.variant_title ? (
                          <span className="text-zinc-500">
                            {" "}
                            ({li.variant_title})
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
