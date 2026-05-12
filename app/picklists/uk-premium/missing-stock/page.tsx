import type { Metadata } from "next";
import Link from "next/link";
import { ClearOrderPickPauseButton } from "@/components/picklist/ClearOrderPickPauseButton";
import { listOrderPickPausesForDay } from "@/lib/orderPickPause";
import { PICKLIST_LIST_KIND_UK_PREMIUM } from "@/lib/picklistListKind";
import {
  formatDayKeyAsOrdinalEnglish,
  getTodayCalendarDateKeyInLondon,
} from "@/lib/warehouseLondonDay";
import { formatKokobaySkuDisplay } from "@/lib/skuDisplay";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Missing stock — Next Day",
  description:
    "UK Premium orders paused from active pick lists because stock was missing at a bin",
};

const LIST = "/picklists/uk-premium";

export default async function UkPremiumMissingStockPage() {
  const dayKey = getTodayCalendarDateKeyInLondon();
  let rows: Awaited<ReturnType<typeof listOrderPickPausesForDay>>;
  try {
    rows = await listOrderPickPausesForDay(dayKey, PICKLIST_LIST_KIND_UK_PREMIUM);
  } catch {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Missing stock
        </h1>
        <p className="text-sm text-red-600 dark:text-red-400">
          Could not load holds. Check MongoDB is configured and reachable.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 pb-12 sm:p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Missing stock (Next Day)
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Same holds as the Next Day pick flow: paused orders stay off active
          lists until you clear the hold here.
        </p>
        <p className="text-sm text-zinc-500">
          Work day:{" "}
          <span className="font-medium text-foreground">
            {formatDayKeyAsOrdinalEnglish(dayKey)}
          </span>{" "}
          (London).
        </p>
        <Link
          href={LIST}
          className="text-sm font-medium text-violet-800 underline dark:text-violet-300"
        >
          ← Next Day pick lists
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-8 text-center dark:border-zinc-600 dark:bg-zinc-950/40">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            No Next Day orders on hold for missing stock
          </p>
        </div>
      ) : (
        <ul className="list-none space-y-4 p-0">
          {rows.map((r) => (
            <li
              key={r.pauseUid}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60 sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-semibold text-foreground">
                    {r.orderNumber}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Updated{" "}
                    {new Date(r.updatedAt).toLocaleString("en-GB", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                  {r.returnToLocations.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200/90">
                        Return any picked units for this order to
                      </p>
                      <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-zinc-800 dark:text-zinc-200">
                        {r.returnToLocations.map((loc) => (
                          <li key={loc}>
                            <span className="font-mono">{loc}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Missing lines recorded
                    </p>
                    <ul className="mt-1 list-none space-y-2 p-0">
                      {r.missingItems.map((m, i) => (
                        <li
                          key={`${r.pauseUid}-${i}-${m.sku}-${m.location}`}
                          className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950/40"
                        >
                          <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                            {formatKokobaySkuDisplay(m.sku)}
                          </span>
                          <span className="mx-2 text-zinc-400">·</span>
                          <span className="text-zinc-800 dark:text-zinc-200">
                            {m.name}
                          </span>
                          <span className="mx-2 text-zinc-400">·</span>
                          <span className="font-mono text-xs">{m.location}</span>
                          <span className="mx-2 text-zinc-400">×</span>
                          <span className="tabular-nums font-medium">
                            {m.quantity}
                          </span>
                          {(m.color || m.size) && (
                            <span className="mt-1 block text-xs text-zinc-500">
                              {[m.color, m.size].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <ClearOrderPickPauseButton pauseUid={r.pauseUid} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
