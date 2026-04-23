"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ConfirmDialog } from "@/components/mui/ConfirmDialog";
import { WAREHOUSE_TZ, formatDateAsOrdinalInTimeZone } from "@/lib/warehouseLondonDay";

export type PicklistListRow = {
  picklistUid: string;
  batchIndex: number;
  ordersPerList: number;
  orderNumbers: string[];
  orderCount: number;
  totalItemsQty: number;
  stopCount: number;
  completedAt: string;
};

type Props = {
  rows: PicklistListRow[];
  ordersPerList: number;
  /** e.g. `/picklists/today` or `/picklists/uk-premium` (no query). */
  listPathBase?: string;
};

function makeListListHref(ordersPerList: number, listPathBase: string) {
  const p = new URLSearchParams();
  p.set("ordersPerList", String(ordersPerList));
  return `${listPathBase}?${p.toString()}`;
}

function formatCompletedDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDateAsOrdinalInTimeZone(d, WAREHOUSE_TZ);
}

function RowActions({
  row,
  onRequestUndo,
  busyId,
}: {
  row: PicklistListRow;
  onRequestUndo: (r: PicklistListRow) => void;
  busyId: string | null;
}) {
  return (
    <button
      type="button"
      onClick={() => onRequestUndo(row)}
      disabled={busyId !== null}
      className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-foreground enabled:hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:enabled:hover:bg-zinc-700"
    >
      {busyId === row.picklistUid ? "…" : "Put back on pick lists"}
    </button>
  );
}

export function CompletedPicklistsClient({
  rows,
  ordersPerList,
  listPathBase: listPathBaseIn,
}: Props) {
  const listPathBase = listPathBaseIn ?? "/picklists/today";
  const listHref = (n: number) => makeListListHref(n, listPathBase);
  const router = useRouter();
  const [undoTarget, setUndoTarget] = useState<PicklistListRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onRequestUndo = useCallback((row: PicklistListRow) => {
    setErr(null);
    setUndoTarget(row);
  }, []);

  const onConfirmUndo = useCallback(async () => {
    if (!undoTarget) return;
    const row = undoTarget;
    setErr(null);
    setBusyId(row.picklistUid);
    try {
      const res = await fetch(
        `/api/picklists/complete/${encodeURIComponent(row.picklistUid)}`,
        {
          method: "DELETE",
        },
      );
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Could not undo");
        return;
      }
      setUndoTarget(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }, [router, undoTarget]);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No completed pick lists for today’s warehouse day yet. Finish a walk
        to record one here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {err && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
          {err}
        </p>
      )}

      <ul className="flex flex-col gap-3 sm:hidden">
        {rows.map((r) => (
          <li
            key={r.picklistUid}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/80"
          >
            <p className="text-xs font-medium text-zinc-500">Order numbers</p>
            <p className="mt-1 break-all font-mono text-sm text-foreground">
              {r.orderNumbers.join(", ")}
            </p>
            <p className="mt-3 text-xs font-medium text-zinc-500">Pick no.</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              #{r.batchIndex}
            </p>
            <div className="mt-4 flex justify-end">
              <RowActions
                row={r}
                onRequestUndo={onRequestUndo}
                busyId={busyId}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden sm:block sm:overflow-x-auto sm:rounded-xl sm:border sm:border-zinc-200 sm:dark:border-zinc-800">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/80">
              <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">UID</th>
              <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">Pick no.</th>
              <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">
                Order numbers
              </th>
              <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">Stops / Qty</th>
              <th className="px-3 py-2.5 font-semibold text-foreground sm:px-4">Completed</th>
              <th className="px-3 py-2.5 text-right font-semibold text-foreground sm:px-4">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.picklistUid}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
              >
                <td
                  className="px-3 py-2.5 align-top font-mono text-xs text-zinc-600 dark:text-zinc-400 sm:px-4"
                  title={r.picklistUid}
                >
                  {r.picklistUid.slice(0, 8)}…
                </td>
                <td className="px-3 py-2.5 align-top tabular-nums sm:px-4">#{r.batchIndex}</td>
                <td className="px-3 py-2.5 align-top sm:px-4">
                  <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200">
                    {r.orderNumbers.join(" · ")}
                  </span>
                </td>
                <td className="px-3 py-2.5 align-top tabular-nums sm:px-4">
                  {r.stopCount} stops, {r.totalItemsQty} units
                </td>
                <td className="px-3 py-2.5 align-top text-foreground sm:px-4">
                  {formatCompletedDate(r.completedAt)}
                </td>
                <td className="px-3 py-2.5 text-right sm:px-4">
                  <RowActions
                    row={r}
                    onRequestUndo={onRequestUndo}
                    busyId={busyId}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        <a
          href={listHref(ordersPerList)}
          className="font-medium text-foreground underline"
        >
          Back to today’s pick lists
        </a>
      </p>

      <ConfirmDialog
        open={undoTarget !== null}
        onClose={() => {
          if (busyId === null) setUndoTarget(null);
        }}
        onConfirm={() => void onConfirmUndo()}
        title="Redo this pick list?"
        confirmLabel="Yes, put back on pick lists"
        confirmColor="primary"
        confirmLoading={
          undoTarget !== null && busyId === undoTarget.picklistUid
        }
      >
        {undoTarget && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 0.5 }}>
            <Typography variant="body1" color="text.primary">
              The orders below will reappear on today’s active pick lists. Displayed pick
              numbers for remaining lists may change.
            </Typography>
            <div>
              <Typography
                variant="caption"
                color="text.secondary"
                component="p"
                sx={{ m: 0, mb: 0.5, display: "block" }}
              >
                Order numbers
              </Typography>
              <Typography
                variant="body2"
                component="p"
                className="font-mono"
                color="text.primary"
                sx={{ m: 0, wordBreak: "break-all" }}
              >
                {undoTarget.orderNumbers.join(" · ")}
              </Typography>
            </div>
            <div>
              <Typography
                variant="caption"
                color="text.secondary"
                component="p"
                sx={{ m: 0, mb: 0.5, display: "block" }}
              >
                Pick no. (recorded)
              </Typography>
              <Typography variant="h6" component="p" sx={{ m: 0 }} color="text.primary">
                #{undoTarget.batchIndex}
              </Typography>
            </div>
          </Box>
        )}
      </ConfirmDialog>
    </div>
  );
}
