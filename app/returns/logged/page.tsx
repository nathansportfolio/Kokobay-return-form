import type { Metadata } from "next";
import Link from "next/link";
import { listReturnLogs } from "@/lib/returnLog";
import { formatGbp } from "@/lib/kokobayOrderLines";
import { WAREHOUSE_TZ, formatDateAsOrdinalInTimeZone } from "@/lib/warehouseLondonDay";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Logged returns",
  description: "Returns registered in the warehouse with email and refund status",
};

function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDateAsOrdinalInTimeZone(d, WAREHOUSE_TZ);
}

export default async function LoggedReturnsPage() {
  let rows: Awaited<ReturnType<typeof listReturnLogs>> = [];
  let err: string | null = null;
  try {
    rows = await listReturnLogs(200);
  } catch {
    err = "Could not load return log. Is MongoDB configured?";
  }

  if (err) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold">Logged returns</h1>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{err}</p>
        <Link
          className="mt-4 inline-block text-sm font-medium text-foreground underline"
          href="/returns"
        >
          Back to returns
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Logged returns</h1>
        <Link
          href="/returns"
          className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          New return
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Per-line reasons are stored; email and full-refund actions are shown here.
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">
          No returns logged yet. Log one from the{" "}
          <Link className="font-medium underline" href="/returns">
            return flow
          </Link>
          .
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/50">
                <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">
                  Logged
                </th>
                <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">
                  Order
                </th>
                <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">
                  Lines
                </th>
                <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">
                  Value
                </th>
                <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">
                  Email
                </th>
                <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">
                  Refund
                </th>
                <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {rows.map((r) => (
                <tr
                  key={r.returnUid}
                  className="text-zinc-800 dark:text-zinc-200"
                >
                  <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                    {fmtWhen(r.createdAt)}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs sm:px-4 sm:text-sm">
                    {r.orderRef}
                  </td>
                  <td className="px-3 py-3 sm:px-4">{r.lineCount}</td>
                  <td className="px-3 py-3 sm:px-4">{formatGbp(r.totalRefundGbp)}</td>
                  <td
                    className={`px-3 py-3 font-medium sm:px-4 ${
                      r.customerEmailSent
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-zinc-500"
                    }`}
                  >
                    {r.customerEmailSent ? "Yes" : "No"}
                  </td>
                  <td
                    className={`px-3 py-3 font-medium sm:px-4 ${
                      r.fullRefundIssued
                        ? "text-red-800 dark:text-red-400"
                        : "text-zinc-500"
                    }`}
                  >
                    {r.fullRefundIssued ? "Yes" : "No"}
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <Link
                      href={`/returns/${encodeURIComponent(r.orderRef)}`}
                      className="font-medium text-foreground underline"
                    >
                      Open return
                    </Link>
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
