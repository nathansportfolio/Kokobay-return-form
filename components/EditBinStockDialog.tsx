"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { StockAtLocation } from "@/lib/getStockByBinCode";
import { formatKokobaySkuDisplay } from "@/lib/skuDisplay";
import { shopifyProductVariantAdminUrl } from "@/lib/shopifyOrderAdminUrl";

export function EditBinStockDialog({
  open,
  binCode,
  stockLines,
  onClose,
  onSuccess,
}: {
  open: boolean;
  binCode: string;
  stockLines: StockAtLocation[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [lines, setLines] = useState<StockAtLocation[]>(stockLines);
  const [removing, setRemoving] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setLines(stockLines);
    }
  }, [open, stockLines]);

  const remove = async (variantId: number) => {
    setRemoving(variantId);
    try {
      const res = await fetch("/api/stock/line", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ binCode, variantId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Could not remove");
        return;
      }
      toast.success("Removed from bin");
      setLines((prev) => prev.filter((s) => s.variantId !== variantId));
      onSuccess();
    } catch {
      toast.error("Request failed");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={removing != null ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      scroll="body"
      aria-labelledby="edit-bin-stock-title"
    >
      <DialogTitle id="edit-bin-stock-title" sx={{ pb: 0.5 }}>
        Stock in{" "}
        <span className="font-mono text-base font-medium text-zinc-600 dark:text-zinc-400">
          {binCode || "—"}
        </span>
      </DialogTitle>
      <DialogContent sx={{ pt: 1, pb: 0 }}>
        {lines.length === 0 ? (
          <p className="text-sm text-zinc-500">No products in this bin.</p>
        ) : (
          <ul className="space-y-2.5">
            {lines.map((s) => {
              const busy = removing === s.variantId;
              return (
                <li
                  key={s.variantId}
                  className="flex flex-col gap-1.5 rounded-md border border-zinc-200/80 bg-zinc-50/80 p-2.5 dark:border-zinc-700 dark:bg-zinc-900/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[0.7rem] font-medium break-all text-foreground">
                      {formatKokobaySkuDisplay(s.sku)}
                    </p>
                    <p className="text-[0.65rem] tabular-nums text-zinc-500">
                      Qty {s.quantity}
                    </p>
                    <a
                      href={shopifyProductVariantAdminUrl(
                        s.productId,
                        s.variantId,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex text-[0.7rem] font-medium text-blue-600 underline dark:text-blue-400"
                    >
                      View in Shopify
                    </a>
                  </div>
                  <Button
                    type="button"
                    size="small"
                    color="error"
                    variant="outlined"
                    disabled={busy}
                    onClick={() => {
                      if (
                        !window.confirm(
                          "Remove this product from the bin? This does not change Shopify inventory.",
                        )
                      ) {
                        return;
                      }
                      void remove(s.variantId);
                    }}
                  >
                    {busy ? "…" : "Remove"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} color="inherit" size="large">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
