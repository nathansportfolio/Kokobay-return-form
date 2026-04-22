import type { Metadata } from "next";
import Link from "next/link";
import { formatGbp } from "@/lib/kokobayOrderLines";
import { getShopifyOrdersForUi } from "@/lib/shopifyOrdersForUi";
import { WAREHOUSE_TZ, formatDateAsOrdinalInTimeZone } from "@/lib/warehouseLondonDay";
import { shopifyOrderAdminUrlByOrderId } from "@/lib/shopifyOrderAdminUrl";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shopify orders",
  description: "Orders from the Shopify Admin API (cached 1 min)",
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDateAsOrdinalInTimeZone(d, WAREHOUSE_TZ);
}

export default async function ShopifyOrdersPage() {
  const result = await getShopifyOrdersForUi();

  if (!result.ok) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold">Shopify orders</h1>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {result.error} — check <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">SHOPIFY_*</code>{" "}
          env and API access.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-foreground underline"
        >
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Shopify orders</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Live data from the Admin API (up to 250, any status). List is cached about{" "}
        1 minute — same as <code className="text-xs">/api/orders</code> and
        the raw JSON.
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {result.orders.length} order{result.orders.length === 1 ? "" : "s"}.
      </p>

      {result.orders.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">No orders returned from Shopify.</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/50">
                <th className="px-3 py-2.5 font-semibold sm:px-4">#</th>
                <th className="px-3 py-2.5 font-semibold sm:px-4">Customer</th>
                <th className="px-3 py-2.5 font-semibold sm:px-4">Email</th>
                <th className="px-3 py-2.5 font-semibold sm:px-4">Total</th>
                <th className="px-3 py-2.5 font-semibold sm:px-4">Placed (London)</th>
                <th className="px-3 py-2.5 font-semibold sm:px-4">Items</th>
                <th className="px-3 py-2.5 font-semibold sm:px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {result.orders.map((o) => (
                <tr
                  key={o.shopifyOrderId}
                  className="text-zinc-800 dark:text-zinc-200"
                >
                  <td className="px-3 py-3 sm:px-4">
                    <span className="font-mono font-medium">{o.orderNumber}</span>
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    {o.customerName || "—"}
                  </td>
                  <td className="max-w-[10rem] truncate px-3 py-3 text-xs sm:px-4">
                    {o.email || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                    {formatGbp(o.total)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs sm:px-4 sm:text-sm">
                    {formatWhen(o.createdAt)}
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    {o.items.length} line{o.items.length === 1 ? "" : "s"} ·{" "}
                    {o.items.reduce((s, i) => s + i.quantity, 0)} unit
                    {o.items.reduce((s, i) => s + i.quantity, 0) === 1
                      ? ""
                      : "s"}
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={`/returns/${encodeURIComponent(String(o.orderNumber))}`}
                        className="inline-flex min-h-8 items-center justify-center rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                        title="Warehouse return"
                      >
                        Return
                      </Link>
                      <a
                        href={shopifyOrderAdminUrlByOrderId(o.shopifyOrderId)}
                        className="inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-[#006e52] bg-[#008060] px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#006e52]"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Shopify
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
