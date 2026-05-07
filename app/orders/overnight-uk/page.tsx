import type { Metadata } from "next";
import Link from "next/link";
import { DateTime } from "luxon";

import { OvernightUkOrdersClient } from "@/components/overnight/OvernightUkOrdersClient";
import { fetchOvernightUkOrderSummaries } from "@/lib/fetchOvernightUkShopifyOrders";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Overnight orders (UK)",
  description:
    "Shopify orders from yesterday 5pm to today 8:30am, Europe/London",
};

function formatLocalTime(iso: string) {
  return DateTime.fromISO(iso, { setZone: true }).toFormat("EEE d MMM, HH:mm");
}

export default async function OvernightUkOrdersPage() {
  const result = await fetchOvernightUkOrderSummaries();

  if (!result.ok) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Overnight orders
        </h1>
        <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Set <code className="font-mono text-xs">SHOPIFY_STORE</code>,{" "}
          <code className="font-mono text-xs">SHOPIFY_CLIENT_ID</code>, and{" "}
          <code className="font-mono text-xs">SHOPIFY_CLIENT_SECRET</code> for Admin API
          access.
        </p>
        <Link
          href="/"
          className="text-sm font-medium text-sky-800 underline underline-offset-2 dark:text-sky-200"
        >
          ← Back to home
        </Link>
      </div>
    );
  }

  const { window, orders } = result;
  console.log(orders.map((o) => o.orderName));
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col p-4 sm:p-6">
      <OvernightUkOrdersClient
        windowKey={`${window.startUtcIso}|${window.endUtcIso}`}
        windowStartLabel={formatLocalTime(window.startLocalIso)}
        windowEndLabel={formatLocalTime(window.endLocalIso)}
        timeZone={window.timeZone}
        orders={orders}
      />
    </div>
  );
}
