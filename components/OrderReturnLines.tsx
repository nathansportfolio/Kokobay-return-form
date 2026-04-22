"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KokobayOrderLine } from "@/lib/kokobayOrderLines";
import { formatGbp } from "@/lib/kokobayOrderLines";
import {
  RETURN_REASONS,
  RETURN_REASON_UNSET,
} from "@/lib/returnReasons";
import { toast } from "sonner";

type LineState = {
  selected: boolean;
  reason: string;
  disposition: "restock" | "dispose";
};

function emptyLine(): LineState {
  return {
    selected: false,
    reason: RETURN_REASON_UNSET,
    disposition: "restock",
  };
}

function safeDomId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 72);
}

function initialState(lines: KokobayOrderLine[]): Record<string, LineState> {
  return Object.fromEntries(
    lines.map((line) => [line.id, emptyLine()]),
  );
}

function orderTotal(lines: KokobayOrderLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}

export function OrderReturnLines({
  orderLabel,
  lines,
}: {
  orderLabel: string;
  lines: KokobayOrderLine[];
}) {
  const [byId, setById] = useState(() => initialState(lines));
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const masterCheckboxRef = useRef<HTMLInputElement>(null);

  const lineKey = useMemo(() => lines.map((l) => l.id).join("\0"), [lines]);

  useEffect(() => {
    setById((prev) => {
      const next = { ...prev };
      for (const line of lines) {
        if (!(line.id in next)) next[line.id] = emptyLine();
      }
      return next;
    });
  }, [lineKey, lines]);

  const updateLine = useCallback((id: string, patch: Partial<LineState>) => {
    setById((prev) => ({
      ...prev,
      [id]: { ...emptyLine(), ...prev[id], ...patch },
    }));
  }, []);

  const setLineSelected = useCallback((id: string, selected: boolean) => {
    setById((prev) => {
      const base = { ...emptyLine(), ...prev[id] };
      return {
        ...prev,
        [id]: {
          ...base,
          selected,
          ...(selected
            ? {}
            : {
                reason: RETURN_REASON_UNSET,
                disposition: "restock" as const,
              }),
        },
      };
    });
  }, []);

  const selectedCount = useMemo(
    () => lines.filter((l) => Boolean(byId[l.id]?.selected)).length,
    [byId, lines],
  );

  const selectedRefund = useMemo(() => {
    let total = 0;
    for (const line of lines) {
      const s = byId[line.id];
      if (s?.selected) total += line.unitPrice * line.quantity;
    }
    return total;
  }, [byId, lines]);

  const allReturned =
    lines.length > 0 && lines.every((l) => byId[l.id]?.selected);
  const someReturned = lines.some((l) => byId[l.id]?.selected);
  const fullOrderTotal = useMemo(() => orderTotal(lines), [lines]);

  useEffect(() => {
    const el = masterCheckboxRef.current;
    if (el) el.indeterminate = someReturned && !allReturned;
  }, [someReturned, allReturned]);

  const setEntireOrderReturned = useCallback(
    (selected: boolean) => {
      setById((prev) => {
        const next = { ...prev };
        for (const line of lines) {
          const base = { ...emptyLine(), ...next[line.id] };
          next[line.id] = {
            ...base,
            selected,
            ...(selected
              ? {}
              : {
                  reason: RETURN_REASON_UNSET,
                  disposition: "restock" as const,
                }),
          };
        }
        return next;
      });
    },
    [lines],
  );

  const sendReceivedEmail = useCallback(() => {
    console.info("Email customer: return received", { order: orderLabel });
    toast.success("Customer email queued", {
      description:
        "We will let them know we received their return. Connect your email API to send for real.",
    });
  }, [orderLabel]);

  const confirmFullRefund = useCallback(() => {
    console.info("Issue full refund", {
      order: orderLabel,
      amount: fullOrderTotal,
    });
    setRefundModalOpen(false);
    toast.success("Full refund recorded", {
      description: `${formatGbp(fullOrderTotal)} for order ${orderLabel}. Hook up payments to process for real.`,
    });
  }, [orderLabel, fullOrderTotal]);

  useEffect(() => {
    if (!refundModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRefundModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [refundModalOpen]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Women&apos;s wear · KOKObay
          </p>
          <p className="font-mono text-lg font-semibold text-foreground">
            {orderLabel}
          </p>
        </div>
        <Link
          href="/returns"
          className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-foreground hover:underline dark:text-zinc-400"
        >
          Different order
        </Link>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Use the checkbox to include a line in this return. Choose a reason and
        whether it goes back on the shelf or is disposed of. The refund total
        updates as you toggle lines.
      </p>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <input
          ref={masterCheckboxRef}
          type="checkbox"
          checked={allReturned}
          onChange={(e) => {
            const next = e.target.checked;
            setEntireOrderReturned(next);
            toast.message(
              next ? "Entire order marked returned" : "Cleared all line selections",
            );
          }}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-400 text-amber-600 focus:ring-amber-500"
        />
        <span>
          <span className="block text-sm font-medium text-foreground">
            Entire order has been returned
          </span>
          <span className="mt-0.5 block text-sm text-zinc-600 dark:text-zinc-400">
            Selects every line on this order as received back. Uncheck to clear
            all selections.
          </span>
        </span>
      </label>

      <ul className="flex flex-col gap-3">
        {lines.map((line) => {
          const row = byId[line.id];
          const s = {
            ...emptyLine(),
            ...row,
            reason:
              !row?.reason || row.reason === ""
                ? RETURN_REASON_UNSET
                : row.reason,
          };
          const lineTotal = line.unitPrice * line.quantity;
          const idBase = safeDomId(line.id);
          const checkboxId = `rl-${idBase}`;
          const reasonFieldId = `rsn-${idBase}`;
          const selected = s.selected;
          return (
            <li key={line.id}>
              <div
                className={`rounded-xl border-2 transition-colors ${
                  selected
                    ? "border-amber-400 bg-amber-50/90 shadow-sm dark:border-amber-500/80 dark:bg-amber-950/35"
                    : "border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/40"
                }`}
              >
                <div className="flex gap-3 p-4 sm:items-start">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white dark:border-zinc-600">
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={selected}
                      onChange={(e) =>
                        setLineSelected(line.id, e.currentTarget.checked)
                      }
                      className="h-5 w-5 rounded border-zinc-400 text-amber-600 focus:ring-amber-500"
                      aria-label={`Include ${line.title} in this return`}
                    />
                  </span>
                  <label
                    htmlFor={checkboxId}
                    className="flex min-w-0 flex-1 cursor-pointer gap-3 sm:items-start"
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                      <Image
                        src={line.imageUrl}
                        alt={line.title}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{line.title}</p>
                      <p className="mt-0.5 font-mono text-xs text-zinc-500">
                        {line.sku} · Qty {line.quantity}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {formatGbp(line.unitPrice)} each ·{" "}
                        <span className="font-semibold text-foreground">
                          Line {formatGbp(lineTotal)}
                        </span>
                      </p>
                    </div>
                  </label>
                </div>

                <div
                  className={`border-t border-amber-200/80 px-4 pb-4 pt-3 dark:border-amber-900/50 ${
                    selected ? "" : "bg-zinc-50/80"
                  }`}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={reasonFieldId}
                        className="block text-xs font-medium uppercase tracking-wide text-zinc-500"
                      >
                        Reason for return
                      </label>
                      <select
                        id={reasonFieldId}
                        name={`reason-${idBase}`}
                        value={s.reason}
                        onChange={(e) =>
                          updateLine(line.id, { reason: e.target.value })
                        }
                        onInput={(e) =>
                          updateLine(line.id, {
                            reason: (e.target as HTMLSelectElement).value,
                          })
                        }
                        className="mt-1.5 min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-amber-500/60 sm:text-sm dark:border-zinc-600"
                      >
                        {RETURN_REASONS.map((opt) => (
                          <option key={String(opt.value)} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <fieldset className="min-w-0">
                      <legend className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Warehouse handling
                      </legend>
                      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm has-[:checked]:border-amber-500 has-[:checked]:ring-1 has-[:checked]:ring-amber-500 dark:border-zinc-700">
                          <input
                            type="radio"
                            name={`disp-${idBase}`}
                            checked={s.disposition === "restock"}
                            onChange={() =>
                              updateLine(line.id, { disposition: "restock" })
                            }
                          />
                          On shelf / to be reshelved
                        </label>
                        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm has-[:checked]:border-amber-500 has-[:checked]:ring-1 has-[:checked]:ring-amber-500 dark:border-zinc-700">
                          <input
                            type="radio"
                            name={`disp-${idBase}`}
                            checked={s.disposition === "dispose"}
                            onChange={() =>
                              updateLine(line.id, { disposition: "dispose" })
                            }
                          />
                          Disposed of
                        </label>
                      </div>
                    </fieldset>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <button
          type="button"
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          onClick={sendReceivedEmail}
        >
          Email customer — we received their return
        </button>
        <button
          type="button"
          className="w-full rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-800 shadow-sm transition-colors hover:bg-red-50 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/50"
          onClick={() => {
            setRefundModalOpen(true);
            toast.message("Confirm full refund", {
              description: `${formatGbp(fullOrderTotal)} — check the dialog.`,
            });
          }}
        >
          Issue full refund ({formatGbp(fullOrderTotal)})
        </button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-background p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">
            Lines marked for return
          </span>
          <span className="font-medium text-foreground">{selectedCount}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2 text-sm dark:border-zinc-800">
          <span className="text-zinc-600 dark:text-zinc-400">
            Refund value (selected lines)
          </span>
          <span className="font-semibold text-foreground">
            {formatGbp(selectedRefund)}
          </span>
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 active:opacity-90"
          onClick={() => {
            if (selectedCount === 0) {
              toast.warning("Select at least one line", {
                description:
                  "Tick the checkboxes for items included in this return.",
              });
              return;
            }
            const payload = lines
              .filter((l) => byId[l.id]?.selected)
              .map((l) => {
                const row = { ...emptyLine(), ...byId[l.id] };
                return {
                  line: l,
                  reason:
                    row.reason === RETURN_REASON_UNSET ? null : row.reason,
                  disposition: row.disposition,
                  selected: row.selected,
                };
              });
            console.info("Return draft", { order: orderLabel, payload });
            toast.success("Return draft saved", {
              description: `${selectedCount} line(s) · ${formatGbp(selectedRefund)} refund value.`,
            });
          }}
        >
          Save return draft
        </button>
        <p className="mt-2 text-center text-xs text-zinc-500">
          Hook this button to your warehouse API when ready.
        </p>
      </div>

      {refundModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setRefundModalOpen(false)}
          />
          <div
            className="relative z-[101] w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="refund-modal-title"
          >
            <h2
              id="refund-modal-title"
              className="text-lg font-semibold text-foreground"
            >
              Issue full refund?
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              This will record a full refund of{" "}
              <span className="font-semibold text-foreground">
                {formatGbp(fullOrderTotal)}
              </span>{" "}
              for order{" "}
              <span className="font-mono font-medium">{orderLabel}</span>. This
              cannot be undone from this screen.
            </p>
            <p className="mt-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Are you sure?
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-foreground hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                onClick={() => {
                  setRefundModalOpen(false);
                  toast.message("Refund cancelled");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800"
                onClick={confirmFullRefund}
              >
                Yes, issue full refund
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
