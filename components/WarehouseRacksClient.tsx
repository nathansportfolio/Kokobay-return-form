"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { useRouter } from "next/navigation";
import { useState, useTransition, type MouseEvent } from "react";
import { toast } from "sonner";
import { AddProductsToBinDialog } from "@/components/AddProductsToBinDialog";
import { EditBinStockDialog } from "@/components/EditBinStockDialog";
import { ConfirmDialog } from "@/components/mui/ConfirmDialog";
import type { BinsLayoutRack } from "@/lib/getBinsLayoutTree";
import type { StockAtLocation } from "@/lib/getStockByBinCode";
import type { LayoutAction, LayoutMutationResult } from "@/lib/binLayoutTypes";
import { SHELF_LEVELS } from "@/lib/generateBins";
import { formatKokobaySkuDisplay } from "@/lib/skuDisplay";
import { shopifyProductVariantAdminUrl } from "@/lib/shopifyOrderAdminUrl";
import { shelfBinBadgeStyle } from "@/lib/warehouseLocationCodes";
import {
  bayCountForRack,
  isValidRackName,
  nextRackCodeFromExisting,
} from "@/lib/warehouseRackLayout";

type Props = {
  racks: BinsLayoutRack[];
  totalBins: number;
  occupiedCount: number;
  stockByCode: Record<string, StockAtLocation[]>;
};

function totalStockItemsForRack(
  rack: BinsLayoutRack,
  stockByCode: Record<string, StockAtLocation[]>,
): number {
  let n = 0;
  for (const bay of rack.bays) {
    for (const cell of bay.levels) {
      for (const s of stockByCode[cell.code] ?? []) {
        n += s.quantity;
      }
    }
  }
  return n;
}

function PadlockIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="10" width="16" height="12" rx="1.2" />
      <path d="M8 10V6.5A4 4 0 0 1 16 6.5V10" />
    </svg>
  );
}

function btnRowProps(onClick: (e: MouseEvent) => void) {
  return (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(e);
  };
}

function levelCountLabel(n: number): string {
  if (n < 1 || n > 6) return "—";
  const s = "ABCDEF".slice(0, n);
  if (n === 1) return "1 level (A)";
  return `${n} levels (A–${s.slice(-1) ?? "A"})`;
}

function AddRackDialog({
  open,
  onClose,
  rackCode,
  addRackBayCount,
  onBayCountChange,
  addRackLevelCount,
  onLevelCountChange,
  isPending,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  /** Next rack/aisle letter code (from sequence); not editable. */
  rackCode: string;
  addRackBayCount: number;
  onBayCountChange: (n: number) => void;
  addRackLevelCount: number;
  onLevelCountChange: (n: number) => void;
  isPending: boolean;
  onCreate: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={isPending ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      scroll="body"
      aria-labelledby="add-rack-dialog-title"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onCreate();
        }}
      >
        <DialogTitle id="add-rack-dialog-title" sx={{ pb: 0.5 }}>
          Add a new rack
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Aisle (rack code) is the next in sequence (A, B, … Z, then{" "}
            <span className="font-mono">AA, AB, …</span>).
            Set bays and how many shelf levels (A through F) each bay has. Codes
            look like <span className="font-mono">AA-01-A</span>.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-3 sm:gap-y-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-xs">
              <div
                className="text-xs font-medium text-zinc-500 dark:text-zinc-400"
                id="add-rack-modal-aisle-label"
              >
                Aisle
              </div>
              <div
                id="add-rack-modal-aisle"
                className="min-w-[4.5rem] max-w-full cursor-default select-none rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-2.5 py-2 font-mono text-sm font-semibold uppercase tracking-tight text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-100"
                aria-labelledby="add-rack-modal-aisle-label"
                aria-readonly
              >
                {rackCode || "—"}
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label
                className="text-xs font-medium text-zinc-500 dark:text-zinc-400"
                htmlFor="add-rack-modal-bays"
              >
                Bays
              </label>
              <input
                id="add-rack-modal-bays"
                type="number"
                min={1}
                max={99}
                className="w-24 rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-900"
                value={addRackBayCount}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isFinite(v)) {
                    onBayCountChange(Math.min(99, Math.max(1, v)));
                  }
                }}
                disabled={isPending}
                autoFocus
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label
                className="text-xs font-medium text-zinc-500 dark:text-zinc-400"
                htmlFor="add-rack-modal-levels"
              >
                Shelves
              </label>
              <select
                id="add-rack-modal-levels"
                className="min-w-[11rem] max-w-full rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                value={addRackLevelCount}
                onChange={(e) =>
                  onLevelCountChange(parseInt(e.target.value, 10) || 1)
                }
                disabled={isPending}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {levelCountLabel(n)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            type="button"
            onClick={onClose}
            color="inherit"
            disabled={isPending}
            size="large"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            color="success"
            variant="contained"
            disabled={
              isPending || !rackCode || !isValidRackName(rackCode)
            }
            size="large"
          >
            {isPending ? "Creating…" : "Create rack"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function LevelChip({
  code,
  level,
  isOccupied,
  stockLines,
  editUnlocked,
  isPending,
  onDelete,
  onAddProducts,
  onEditBin,
}: {
  code: string;
  level: string;
  isOccupied: boolean;
  stockLines: StockAtLocation[];
  editUnlocked: boolean;
  isPending: boolean;
  onDelete: () => void;
  onAddProducts: () => void;
  onEditBin: () => void;
}) {
  const n = level.toUpperCase().charCodeAt(0) - "A".charCodeAt(0) + 1;
  return (
    <details className="group/level overflow-hidden rounded-lg border border-zinc-200/90 bg-white shadow-sm open:ring-2 open:ring-zinc-300/80 dark:border-zinc-700 dark:bg-zinc-900/80 dark:open:ring-zinc-600/50">
      <summary
        className="flex cursor-pointer list-none flex-col gap-1 p-2.5 [&::-webkit-details-marker]:hidden"
        title={`${code} · Level ${n} (${level}) — open for SKUs`}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md px-1.5 text-xs font-bold tabular-nums"
            style={shelfBinBadgeStyle(level, 1)}
          >
            {level}
          </span>
          <div className="flex items-center gap-1">
            <span
              className={
                isOccupied
                  ? "h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-sm ring-2 ring-emerald-500/30"
                  : "h-2 w-2 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600"
              }
              title={isOccupied ? "Has stock" : "No stock"}
            />
            <span className="text-zinc-400 transition group-open/level:rotate-180 dark:text-zinc-500">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </span>
          </div>
        </div>
        <span className="font-mono text-[0.7rem] leading-tight text-zinc-600 dark:text-zinc-400">
          {code}
        </span>
      </summary>
      <div className="space-y-2 border-t border-zinc-100 bg-zinc-50/90 px-2.5 py-2.5 text-left dark:border-zinc-700/80 dark:bg-zinc-950/50">
        <div
          className="flex flex-wrap items-center gap-1.5"
          onClick={btnRowProps(() => {})}
        >
          <button
            type="button"
            disabled={isPending}
            className="min-w-0 flex-1 rounded-md border border-zinc-300/80 bg-white px-2 py-1.5 text-[0.7rem] font-medium text-foreground shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-800/80 sm:flex-none"
            onClick={btnRowProps(onAddProducts)}
          >
            Add
          </button>
          {editUnlocked && stockLines.length > 0 ? (
            <button
              type="button"
              disabled={isPending}
              className="rounded-md border border-zinc-300/80 bg-white px-2 py-1.5 text-[0.7rem] font-medium text-foreground shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-800/80"
              onClick={btnRowProps(onEditBin)}
            >
              Edit
            </button>
          ) : null}
          {editUnlocked ? (
            <button
              type="button"
              disabled={isPending}
              className="rounded-md border border-red-300/80 bg-red-50 px-2 py-1.5 text-[0.7rem] font-medium text-red-800 hover:bg-red-100/90 disabled:opacity-50 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-900/50"
              onClick={btnRowProps(() => {
                if (
                  !window.confirm(
                    `Remove this bin level (${code})?\n\nAny stock in this location will be removed.`,
                  )
                ) {
                  return;
                }
                onDelete();
              })}
            >
              Delete level
            </button>
          ) : null}
        </div>
        {stockLines.length > 0 ? (
            <ul className="space-y-2.5">
            {stockLines.map((s) => (
              <li
                key={`${s.variantId}-${s.sku}`}
                className="rounded-md border border-zinc-200/80 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900/90"
              >
                <p className="font-mono text-[0.7rem] font-medium break-all text-foreground">
                  {formatKokobaySkuDisplay(s.sku)}
                </p>
                <p className="mt-0.5 text-[0.65rem] tabular-nums text-zinc-500">
                  Qty {s.quantity}
                </p>
                <a
                  href={shopifyProductVariantAdminUrl(s.productId, s.variantId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-0.5 text-[0.7rem] font-medium text-blue-600 underline decoration-blue-600/30 underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  View in Shopify
                  <span className="sr-only"> (opens new tab)</span>
                  <svg
                    className="h-3 w-3 shrink-0 opacity-80"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </li>
            ))}
            </ul>
        ) : !editUnlocked ? (
          <p className="text-[0.7rem] leading-snug text-zinc-500 dark:text-zinc-400">
            {isOccupied
              ? "This slot is empty or stock is not shown."
              : "No stock in this bin."}
          </p>
        ) : null}
      </div>
    </details>
  );
}

function RackBlock({
  rack,
  showSectionTitle,
  showSectionSpacer,
  stockByCode,
  editUnlocked,
  isPending,
  mutate,
  onAddProducts,
  onEditBin,
}: {
  rack: BinsLayoutRack;
  showSectionTitle: boolean;
  showSectionSpacer: boolean;
  stockByCode: Record<string, StockAtLocation[]>;
  editUnlocked: boolean;
  isPending: boolean;
  mutate: (a: LayoutAction, o?: { onSuccess?: () => void }) => void;
  onAddProducts: (binCode: string) => void;
  onEditBin: (binCode: string) => void;
}) {
  const [deleteRackOpen, setDeleteRackOpen] = useState(false);
  const binCount = rack.bays.reduce((n, b) => n + b.levels.length, 0);
  const totalItems = totalStockItemsForRack(rack, stockByCode);
  const rackHasStock = totalItems > 0;

  return (
    <div
      className={
        showSectionSpacer
          ? "flex flex-col gap-2 border-t border-zinc-200 pt-6 dark:border-zinc-800"
          : "flex flex-col gap-2"
      }
    >
      {showSectionTitle ? (
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {rack.section === "A–I"
            ? "Section 1"
            : rack.section === "AA+"
              ? "Section 3"
              : "Section 2"}{" "}
          · {rack.section}
        </h2>
      ) : null}
      <details className="group/rack overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-left font-medium text-foreground transition-colors hover:bg-zinc-100/80 dark:hover:bg-zinc-900/80 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <span className="inline-flex h-10 min-w-10 max-w-[5.5rem] shrink-0 items-center justify-center rounded-lg border-2 border-zinc-300 bg-white px-1.5 text-center text-base font-bold tabular-nums leading-none text-zinc-900 sm:text-lg dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
              {rack.rack}
            </span>
            <span className="min-w-0">
              <span className="block text-base">Rack {rack.rack}</span>
              <span className="mt-0.5 flex items-center gap-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
                <span
                  className={
                    rackHasStock
                      ? "h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-sm ring-2 ring-emerald-500/30"
                      : "h-2 w-2 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600"
                  }
                  title={
                    rackHasStock
                      ? `${totalItems} item${totalItems === 1 ? "" : "s"} in this rack`
                      : "No items in this rack"
                  }
                />
                <span>
                  {rack.bays.length} bay{rack.bays.length === 1 ? "" : "s"} ·{" "}
                  {binCount} bin{binCount === 1 ? "" : "s"} ·{" "}
                  <span className="font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                    {totalItems} item{totalItems === 1 ? "" : "s"}
                  </span>{" "}
                  in stock
                </span>
              </span>
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            {editUnlocked ? (
              <span
                className="flex items-center gap-1"
                onClick={btnRowProps(() => {})}
              >
                <button
                  type="button"
                  disabled={isPending}
                  className="whitespace-nowrap rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800/80"
                  onClick={btnRowProps(() => {
                    if (
                      !window.confirm(
                        `Add a new bay to rack ${rack.rack}?\n\nA full height column (6 levels) will be created for the next bay number.`,
                      )
                    ) {
                      return;
                    }
                    mutate({ action: "addBay", rack: rack.rack });
                  })}
                >
                  + Bay
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  className="whitespace-nowrap rounded-md border border-red-300/80 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100/90 disabled:opacity-50 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-900/50"
                  onClick={btnRowProps(() => {
                    setDeleteRackOpen(true);
                  })}
                >
                  Delete rack
                </button>
              </span>
            ) : null}
            <span className="shrink-0 text-zinc-400 transition group-open/rack:rotate-180 dark:text-zinc-500">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </span>
          </div>
        </summary>
        <div className="border-t border-zinc-200/80 px-3 py-3 dark:border-zinc-800/80 sm:px-4">
          <div className="flex flex-col gap-3">
            {rack.bays.map((b) => {
              const levelSet = new Set(b.levels.map((l) => l.level.toUpperCase()));
              const missingLevels = SHELF_LEVELS.filter(
                (L) => !levelSet.has(L),
              );
              return (
                <details
                  key={b.bay}
                  className="group/bay overflow-hidden rounded-lg border border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-zinc-50 dark:hover:bg-zinc-800/60 [&::-webkit-details-marker]:hidden">
                    <span>
                      Bay <span className="font-mono tabular-nums">{b.bay}</span>
                      <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
                        {b.levels.length} level{b.levels.length === 1 ? "" : "s"}
                      </span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {editUnlocked && missingLevels.length > 0 ? (
                        <span
                          onClick={btnRowProps(() => {})}
                          className="mr-0.5 flex items-center gap-0.5"
                        >
                          <span className="text-[0.65rem] text-zinc-500">Add</span>
                          <select
                            className="max-w-[3.5rem] rounded border border-zinc-200 bg-white py-0.5 pl-1 pr-0.5 text-[0.7rem] dark:border-zinc-600 dark:bg-zinc-800"
                            defaultValue=""
                            disabled={isPending}
                            onClick={btnRowProps(() => {})}
                            onChange={(e) => {
                              const v = e.target.value;
                              e.target.value = "";
                              if (!v) return;
                              mutate({
                                action: "addLevel",
                                rack: rack.rack,
                                bay: b.bay,
                                level: v,
                              });
                            }}
                          >
                            <option value="">Level…</option>
                            {missingLevels.map((L) => (
                              <option key={L} value={L}>
                                {L}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[0.65rem] font-medium text-foreground dark:border-zinc-600 dark:bg-zinc-800/80"
                            disabled={isPending}
                            onClick={btnRowProps(() => {
                              mutate({
                                action: "addMissingLevels",
                                rack: rack.rack,
                                bay: b.bay,
                              });
                            })}
                            title="Insert every level A–F that is not already present"
                          >
                            all gaps
                          </button>
                        </span>
                      ) : null}
                      {editUnlocked && missingLevels.length === 0 ? (
                        <span
                          onClick={btnRowProps(() => {})}
                          className="text-[0.65rem] text-zinc-400"
                        >
                          6/6
                        </span>
                      ) : null}
                      {editUnlocked ? (
                        <button
                          type="button"
                          disabled={isPending}
                          className="whitespace-nowrap rounded-md border border-red-300/80 bg-red-50/90 px-2 py-0.5 text-[0.65rem] font-medium text-red-800 hover:bg-red-100/90 disabled:opacity-50 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-200"
                          onClick={btnRowProps(() => {
                            if (
                              !window.confirm(
                                `Delete bay ${b.bay} on rack ${rack.rack} and all ${b.levels.length} level${b.levels.length === 1 ? "" : "s"}? Stock in those locations will be removed.`,
                              )
                            ) {
                              return;
                            }
                            mutate({
                              action: "deleteBay",
                              rack: rack.rack,
                              bay: b.bay,
                            });
                          })}
                        >
                          Delete bay
                        </button>
                      ) : null}
                      <span className="text-zinc-400 transition group-open/bay:rotate-180">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </span>
                    </div>
                  </summary>
                  <div className="border-t border-zinc-100 px-3 py-3 dark:border-zinc-800/80">
                    <div className="grid items-start grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                      {b.levels.map((cell) => (
                        <LevelChip
                          key={cell.code}
                          code={cell.code}
                          level={cell.level}
                          isOccupied={cell.isOccupied}
                          stockLines={stockByCode[cell.code] ?? []}
                          editUnlocked={editUnlocked}
                          isPending={isPending}
                          onDelete={() =>
                            mutate({ action: "deleteLevel", code: cell.code })
                          }
                          onAddProducts={() => onAddProducts(cell.code)}
                          onEditBin={() => onEditBin(cell.code)}
                        />
                      ))}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </details>

      <ConfirmDialog
        open={deleteRackOpen}
        onClose={() => setDeleteRackOpen(false)}
        onConfirm={() => {
          mutate(
            { action: "deleteRack", rack: rack.rack },
            { onSuccess: () => setDeleteRackOpen(false) },
          );
        }}
        title={`Delete rack ${rack.rack}?`}
        confirmLabel="Delete rack"
        cancelLabel="Cancel"
        confirmColor="error"
        confirmLoading={isPending}
      >
        <p className="m-0 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          This removes the whole rack:{" "}
          <span className="font-mono text-foreground">{binCount}</span> bin
          {binCount === 1 ? "" : "s"} in rack{" "}
          <span className="font-mono font-medium text-foreground">
            {rack.rack}
          </span>
          . Any stock in those locations is removed.{" "}
          <span className="text-red-800/90 dark:text-red-200/90">
            This can&apos;t be undone.
          </span>
        </p>
      </ConfirmDialog>
    </div>
  );
}

export function WarehouseRacksClient({
  racks,
  totalBins,
  occupiedCount,
  stockByCode,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editUnlocked, setEditUnlocked] = useState(false);
  const [addRackLetter, setAddRackLetter] = useState("");
  const [addRackBayCount, setAddRackBayCount] = useState(4);
  const [addRackLevelCount, setAddRackLevelCount] = useState(6);
  const [addRackModalOpen, setAddRackModalOpen] = useState(false);
  const [addProductBin, setAddProductBin] = useState<string | null>(null);
  const [editBinCode, setEditBinCode] = useState<string | null>(null);

  const free = totalBins - occupiedCount;

  const mutate = (
    body: LayoutAction,
    options?: { onSuccess?: () => void },
  ) => {
    startTransition(async () => {
      const res = await fetch("/api/bins/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as LayoutMutationResult;
      if (!data.ok) {
        toast.error(data.error ?? "Request failed");
        return;
      }
      toast.success(data.message);
      setAddRackLetter("");
      setAddRackBayCount(4);
      setAddRackLevelCount(6);
      options?.onSuccess?.();
      router.refresh();
    });
  };

  const openAddRackModal = () => {
    const usedRacks = new Set(racks.map((r) => r.rack));
    const next = nextRackCodeFromExisting(usedRacks);
    setAddRackLetter(next);
    setAddRackBayCount(bayCountForRack(next));
    setAddRackLevelCount(6);
    setAddRackModalOpen(true);
  };

  const submitAddRack = () => {
    if (!isValidRackName(addRackLetter)) {
      toast.error("Enter a valid rack code (letters A–Z only, e.g. AA, AB).");
      return;
    }
    if (!addRackLetter) return;
    const bc = Math.min(99, Math.max(1, Math.floor(addRackBayCount)));
    const lc = Math.min(6, Math.max(1, Math.floor(addRackLevelCount)));
    mutate(
      { action: "addRack", rack: addRackLetter, bayCount: bc, levelCount: lc },
      { onSuccess: () => setAddRackModalOpen(false) },
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 p-4 pb-10 sm:p-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Warehouse layout
            </h1>
            <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              Rack → bay → level. Each location is{" "}
              <span className="font-mono">RACK-BAY-LEVEL</span> (e.g.{" "}
              <span className="font-mono">A-04-C</span>). Open a level to see
              what&apos;s stored there. A green dot means the slot is marked
              in use in the layout.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {editUnlocked ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 shadow-sm ring-1 ring-emerald-500/20 hover:bg-emerald-100/90 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-100 dark:ring-emerald-500/15 dark:hover:bg-emerald-900/40"
                onClick={openAddRackModal}
                title="Add a new rack (next aisle code in sequence)"
              >
                Add rack
              </button>
            ) : null}
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
                editUnlocked
                  ? "border-amber-500/50 bg-amber-50 text-amber-950 hover:bg-amber-100/90 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-900/40"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              }`}
              onClick={() => setEditUnlocked((u) => !u)}
              title={
                editUnlocked
                  ? "Lock: hide add/delete for racks, bays, and levels"
                  : "Unlock: show controls to add or remove racks, bays, and levels"
              }
            >
              <PadlockIcon />
              {editUnlocked ? "Editing (tap to lock)" : "Locked (tap to edit)"}
            </button>
          </div>
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-zinc-500">Total bin locations</dt>
            <dd className="font-semibold tabular-nums text-foreground">
              {totalBins}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">With stock</dt>
            <dd className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {occupiedCount}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Empty</dt>
            <dd className="font-semibold tabular-nums text-foreground">
              {free}
            </dd>
          </div>
        </dl>
      </div>

      {totalBins === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-amber-300/80 bg-amber-50/80 p-5 dark:border-amber-800/60 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-950 dark:text-amber-200">
            No bins in the database yet.
          </p>
          {!editUnlocked ? (
            <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/80">
              Unlock layout editing to add a rack, bays, and levels.
            </p>
          ) : null}
          {editUnlocked ? (
            <div className="mt-3">
              <button
                type="button"
                className="text-sm font-semibold text-emerald-800 underline decoration-emerald-800/30 underline-offset-2 hover:text-emerald-900 dark:text-emerald-200 dark:decoration-emerald-200/30 dark:hover:text-emerald-100"
                onClick={openAddRackModal}
              >
                Add a rack (custom bays and levels)…
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-1">
          {racks.map((rack, i) => {
            const prev = racks[i - 1];
            const showSectionTitle =
              i === 0 || (prev && prev.section !== rack.section);
            return (
              <RackBlock
                key={rack.rack}
                rack={rack}
                showSectionTitle={showSectionTitle}
                showSectionSpacer={Boolean(showSectionTitle && i > 0)}
                stockByCode={stockByCode}
                editUnlocked={editUnlocked}
                isPending={isPending}
                mutate={mutate}
                onAddProducts={(code) => setAddProductBin(code)}
                onEditBin={(code) => setEditBinCode(code)}
              />
            );
          })}
          {editUnlocked && totalBins > 0 ? (
            <div className="mt-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <button
                type="button"
                className="text-sm font-semibold text-emerald-800 underline decoration-emerald-800/30 underline-offset-2 hover:text-emerald-900 dark:text-emerald-200 dark:decoration-emerald-200/30 dark:hover:text-emerald-100"
                onClick={openAddRackModal}
              >
                Add another rack…
              </button>
            </div>
          ) : null}
        </div>
      )}

      <AddRackDialog
        open={addRackModalOpen}
        onClose={() => setAddRackModalOpen(false)}
        rackCode={addRackLetter}
        addRackBayCount={addRackBayCount}
        onBayCountChange={setAddRackBayCount}
        addRackLevelCount={addRackLevelCount}
        onLevelCountChange={setAddRackLevelCount}
        isPending={isPending}
        onCreate={submitAddRack}
      />

      <AddProductsToBinDialog
        open={Boolean(addProductBin)}
        binCode={addProductBin ?? ""}
        onClose={() => setAddProductBin(null)}
        onSuccess={() => router.refresh()}
      />
      {editBinCode ? (
        <EditBinStockDialog
          key={editBinCode}
          open
          binCode={editBinCode}
          stockLines={stockByCode[editBinCode] ?? []}
          onClose={() => setEditBinCode(null)}
          onSuccess={() => router.refresh()}
        />
      ) : null}

      <p className="mt-10 text-xs text-zinc-500 dark:text-zinc-500">
        {editUnlocked
          ? "Layout changes are saved to the server. Deleting a bin, bay, or rack also removes any stock in those places. "
          : "Unlock the layout to add a rack, bays, or levels, or to place stock. "}
        <span className="whitespace-nowrap">Shopify admin</span> links use your
        configured store (see <code className="text-[0.65rem]">.env.example</code>).
      </p>
    </div>
  );
}
