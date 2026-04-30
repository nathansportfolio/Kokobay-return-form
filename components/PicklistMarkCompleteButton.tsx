"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ConfirmDialog } from "@/components/mui/ConfirmDialog";
import type { OrderAssembly, PickStep } from "@/lib/fetchTodaysPickLists";
import {
  PICKLIST_LIST_KIND_STANDARD,
  type PicklistListKind,
} from "@/lib/picklistListKind";

type Props = {
  dayKey: string;
  /** Daily pick sequence (1–N for the day, after completed picks). */
  pickListNumber: number;
  ordersPerList: number;
  itemsPerList: number;
  orderNumbers: string[];
  steps: PickStep[];
  assembly: OrderAssembly[];
  listKind?: PicklistListKind;
};

export function PicklistMarkCompleteButton({
  dayKey,
  pickListNumber,
  ordersPerList,
  itemsPerList,
  orderNumbers,
  steps,
  assembly,
  listKind: listKindIn,
}: Props) {
  const listKind = listKindIn ?? PICKLIST_LIST_KIND_STANDARD;
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const totalItemsQty = steps.reduce((s, st) => s + st.quantity, 0);
  const orderCount = orderNumbers.length;

  const performComplete = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/picklists/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayKey,
          orderNumbers,
          batchIndex: pickListNumber,
          ordersPerList,
          itemsPerList,
          steps,
          assembly,
          totalItemsQty,
          orderCount,
          durationMs: 0,
          listKind,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setErr(data.error ?? "Could not mark as complete");
        return;
      }
      setDialogOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [
    assembly,
    dayKey,
    listKind,
    orderCount,
    orderNumbers,
    pickListNumber,
    ordersPerList,
    itemsPerList,
    router,
    steps,
    totalItemsQty,
  ]);

  return (
    <div className="border-t border-zinc-200 bg-zinc-50/50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/30 sm:px-5">
      {err && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {err}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setErr(null);
            setDialogOpen(true);
          }}
          disabled={busy}
          className="min-h-11 w-full min-w-[10rem] rounded-xl border-2 border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 sm:w-auto dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {busy ? "Saving…" : "Completed"}
        </button>
      </div>
      <ConfirmDialog
        open={dialogOpen}
        onClose={() => {
          if (!busy) setDialogOpen(false);
        }}
        onConfirm={() => void performComplete()}
        title="Mark this pick as complete?"
        confirmLabel="Yes, mark complete"
        confirmColor="primary"
        confirmLoading={busy}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Typography variant="body1" color="text.primary">
            This will record the pick for pick list <strong>#{pickListNumber}</strong> and
            move these orders out of the active list for today.
          </Typography>
          <p className="m-0 font-mono text-sm text-zinc-600">
            {orderNumbers.join(" · ")}
          </p>
        </Box>
      </ConfirmDialog>
    </div>
  );
}
