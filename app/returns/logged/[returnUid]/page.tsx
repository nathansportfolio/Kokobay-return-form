import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getReturnLogByUid } from "@/lib/returnLog";
import { formatGbp } from "@/lib/kokobayOrderLines";
import { WAREHOUSE_TZ, formatDateAsOrdinalInTimeZone } from "@/lib/warehouseLondonDay";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ returnUid: string }> };

function formatIso(d: Date | string | undefined): string {
  if (d == null) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return formatDateAsOrdinalInTimeZone(dt, WAREHOUSE_TZ);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { returnUid } = await params;
  return { title: `Return log · ${returnUid.slice(0, 8)}` };
}

export default async function ReturnLogDetailPage({ params }: PageProps) {
  const { returnUid } = await params;
  const uid = decodeURIComponent(returnUid);
  const doc = await getReturnLogByUid(uid);
  if (!doc) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
      <p className="text-sm">
        <Link
          className="font-medium text-zinc-600 hover:underline dark:text-zinc-400"
          href="/returns/logged"
        >
          ← All logged returns
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-semibold">Return log</h1>
      <p className="mt-1 break-all font-mono text-sm text-zinc-600 dark:text-zinc-400">
        {doc.returnUid}
      </p>

      <dl className="mt-6 flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-2">
        <div>
          <dt className="text-zinc-500">Order</dt>
          <dd className="font-mono font-medium text-foreground">{doc.orderRef}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Registered</dt>
          <dd className="text-foreground">{formatIso(doc.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Customer email marked sent</dt>
          <dd
            className={
              doc.customerEmailSent
                ? "font-medium text-emerald-800 dark:text-emerald-300"
                : "text-zinc-600"
            }
          >
            {doc.customerEmailSent ? "Yes" : "No"}{" "}
            {doc.customerEmailSentAt
              ? `· ${formatIso(doc.customerEmailSentAt)}`
              : null}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Full refund marked</dt>
          <dd
            className={
              doc.fullRefundIssued
                ? "font-medium text-red-900 dark:text-red-300"
                : "text-zinc-600"
            }
          >
            {doc.fullRefundIssued ? "Yes" : "No"}{" "}
            {doc.fullRefundAmountGbp != null
              ? `· ${formatGbp(doc.fullRefundAmountGbp)}`
              : null}{" "}
            {doc.fullRefundIssuedAt
              ? `· ${formatIso(doc.fullRefundIssuedAt)}`
              : null}
          </dd>
        </div>
      </dl>

      <h2 className="mb-2 mt-8 text-lg font-semibold">Lines and reasons</h2>
      <ol className="list-decimal space-y-3 pl-5 text-sm text-zinc-800 dark:text-zinc-200">
        {doc.lines.map((l) => (
          <li key={l.lineId} className="pl-0.5">
            <p className="font-medium text-foreground">{l.title}</p>
            <p className="mt-0.5 font-mono text-xs text-zinc-500">
              {l.sku} · Qty {l.quantity} · {formatGbp(l.lineTotalGbp)} included
            </p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              <span className="text-zinc-500">Reason: </span>
              {l.reasonLabel}
            </p>
            <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">
              <span className="text-zinc-500">Handling: </span>
              {l.disposition === "restock" ? "On shelf / reshelve" : "Disposed of"}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
