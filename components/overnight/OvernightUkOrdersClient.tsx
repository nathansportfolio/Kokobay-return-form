"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { OvernightUkOrderSummary } from "@/lib/fetchOvernightUkShopifyOrders";
import {
  applyOvernightTemplateHtml,
  applyOvernightTemplatePlain,
  DEFAULT_OVERNIGHT_EMAIL_TEMPLATE,
  formatOvernightItemsHtml,
  formatOvernightItemsPlain,
  OVERNIGHT_EMAIL_TEMPLATE_STORAGE_KEY,
} from "@/lib/overnightCustomerEmail";

const OVERNIGHT_FLAGS_STORAGE_KEY = "kokobay-overnight-order-flags-v1";

type OrderFlagRow = {
  complete: boolean;
  customerReplied: boolean;
};

type FlagsBlob = {
  windowKey: string;
  byOrderId: Record<string, OrderFlagRow>;
};

type Props = {
  /** Identifies the date window so flags reset when the overnight range changes. */
  windowKey: string;
  windowStartLabel: string;
  windowEndLabel: string;
  timeZone: string;
  orders: OvernightUkOrderSummary[];
};

function buildEmailBodies(template: string, order: OvernightUkOrderSummary) {
  const name = order.greetingName;
  const plain = applyOvernightTemplatePlain(
    template,
    name,
    formatOvernightItemsPlain(order.items),
  );
  const html = applyOvernightTemplateHtml(
    template,
    name,
    formatOvernightItemsHtml(order.items),
  );
  return { plain, html };
}

function nlToBr(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => (
    <span key={i}>
      {i > 0 ? <br /> : null}
      {line}
    </span>
  ));
}

function OvernightEmailPreview({
  template,
  order,
}: {
  template: string;
  order: OvernightUkOrderSummary;
}) {
  const withName = template.replaceAll("{{name}}", order.greetingName);
  const marker = "{{items}}";
  const idx = withName.indexOf(marker);
  if (idx === -1) {
    return (
      <div className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
        {nlToBr(withName)}
      </div>
    );
  }
  const before = withName.slice(0, idx);
  const after = withName.slice(idx + marker.length);
  return (
    <div className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
      {nlToBr(before)}
      <ul className="my-3 list-none space-y-1.5 pl-0">
        {order.items.map((it, j) => (
          <li key={j}>
            <span className="tabular-nums text-zinc-500">{it.quantity}×</span>{" "}
            {it.productTitle}
            {it.size ? (
              <>
                {" "}
                — <strong className="text-foreground">{it.size}</strong>
              </>
            ) : null}
          </li>
        ))}
      </ul>
      {nlToBr(after)}
    </div>
  );
}

async function copyEmailToClipboard(plain: string, html: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    await Promise.reject(new Error("Clipboard unavailable"));
  }
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": new Blob([plain], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      }),
    ]);
  } catch {
    await navigator.clipboard.writeText(plain);
  }
}

function readFlagsForWindow(
  windowKey: string,
  validIds: Set<string>,
): Record<string, OrderFlagRow> {
  try {
    const raw = localStorage.getItem(OVERNIGHT_FLAGS_STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as FlagsBlob;
    if (p.windowKey !== windowKey || !p.byOrderId || typeof p.byOrderId !== "object") {
      return {};
    }
    const out: Record<string, OrderFlagRow> = {};
    for (const id of validIds) {
      const row = p.byOrderId[id];
      if (row && typeof row.complete === "boolean") {
        out[id] = {
          complete: row.complete,
          customerReplied: !!row.customerReplied,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function pruneFlagsToOrders(
  flags: Record<string, OrderFlagRow>,
  validIds: Set<string>,
): Record<string, OrderFlagRow> {
  const out: Record<string, OrderFlagRow> = {};
  for (const id of validIds) {
    const row = flags[id];
    if (row) out[id] = row;
  }
  return out;
}

export function OvernightUkOrdersClient({
  windowKey,
  windowStartLabel,
  windowEndLabel,
  timeZone,
  orders,
}: Props) {
  const [template, setTemplate] = useState(DEFAULT_OVERNIGHT_EMAIL_TEMPLATE);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [orderFlags, setOrderFlags] = useState<Record<string, OrderFlagRow>>({});
  const [flagsHydrated, setFlagsHydrated] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [copyDetail, setCopyDetail] = useState<string | null>(null);

  const validIdSet = useMemo(
    () => new Set(orders.map((o) => o.shopifyOrderId)),
    [orders],
  );

  const orderIdsJoined = useMemo(
    () => orders.map((o) => o.shopifyOrderId).join(","),
    [orders],
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(OVERNIGHT_EMAIL_TEMPLATE_STORAGE_KEY);
      if (saved != null && saved.trim() !== "") {
        setTemplate(saved);
      }
    } catch {
      /* ignore */
    }
    setTemplateLoaded(true);
  }, []);

  useEffect(() => {
    if (!templateLoaded) return;
    try {
      localStorage.setItem(OVERNIGHT_EMAIL_TEMPLATE_STORAGE_KEY, template);
    } catch {
      /* ignore */
    }
  }, [template, templateLoaded]);

  useEffect(() => {
    const ids = new Set(orderIdsJoined.split(",").filter(Boolean));
    setOrderFlags(readFlagsForWindow(windowKey, ids));
    setFlagsHydrated(true);
  }, [windowKey, orderIdsJoined]);

  useEffect(() => {
    if (!flagsHydrated) return;
    try {
      const pruned = pruneFlagsToOrders(orderFlags, validIdSet);
      const blob: FlagsBlob = { windowKey, byOrderId: pruned };
      localStorage.setItem(OVERNIGHT_FLAGS_STORAGE_KEY, JSON.stringify(blob));
    } catch {
      /* ignore */
    }
  }, [orderFlags, windowKey, flagsHydrated, validIdSet]);

  const previewOrder = orders[0] ?? null;

  const total = orders.length;
  const completeCount = useMemo(
    () =>
      orders.filter((o) => orderFlags[o.shopifyOrderId]?.complete).length,
    [orders, orderFlags],
  );
  const repliedCount = useMemo(
    () =>
      orders.filter((o) => orderFlags[o.shopifyOrderId]?.customerReplied).length,
    [orders, orderFlags],
  );

  const flashCopy = useCallback((title: string, detail?: string) => {
    setCopyMessage(title);
    setCopyDetail(detail ?? null);
    window.setTimeout(() => {
      setCopyMessage(null);
      setCopyDetail(null);
    }, 2200);
  }, []);

  const onCopyMessage = useCallback(
    async (order: OvernightUkOrderSummary) => {
      const { plain, html } = buildEmailBodies(template, order);
      try {
        await copyEmailToClipboard(plain, html);
        flashCopy("Message copied", order.email || undefined);
      } catch {
        flashCopy("Could not copy message");
      }
    },
    [template, flashCopy],
  );

  const onCopyAddress = useCallback(
    async (email: string) => {
      const trimmed = email.trim();
      if (!trimmed) return;
      try {
        await navigator.clipboard.writeText(trimmed);
        flashCopy("Address copied", trimmed);
      } catch {
        flashCopy("Could not copy address");
      }
    },
    [flashCopy],
  );

  const setFlag = useCallback(
    (orderId: string, field: keyof OrderFlagRow, value: boolean) => {
      setOrderFlags((prev) => {
        const cur = prev[orderId] ?? {
          complete: false,
          customerReplied: false,
        };
        return {
          ...prev,
          [orderId]: { ...cur, [field]: value },
        };
      });
    },
    [],
  );

  return (
    <div className="flex w-full max-w-4xl flex-1 flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Overnight orders
          </h1>
          <Link
            href="/"
            className="text-sm font-medium text-sky-800 underline decoration-sky-800/30 underline-offset-2 dark:text-sky-200"
          >
            Home
          </Link>
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-foreground">Live from Shopify</span>
          . Orders with <code className="text-xs">created_at</code> from{" "}
          <span className="whitespace-nowrap font-medium text-foreground">
            {windowStartLabel}
          </span>{" "}
          to{" "}
          <span className="whitespace-nowrap font-medium text-foreground">
            {windowEndLabel}
          </span>{" "}
          ({timeZone}).
        </p>
        {total > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold tabular-nums text-emerald-950 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-100"
              aria-live="polite"
            >
              {completeCount}/{total} complete
            </span>
            <span
              className="inline-flex items-center rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-semibold tabular-nums text-violet-950 dark:border-violet-800/80 dark:bg-violet-950/40 dark:text-violet-100"
              aria-live="polite"
            >
              {repliedCount}/{total} customer replied
            </span>
          </div>
        ) : null}
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
          Template is saved in this browser. Use{" "}
          <code className="font-mono">{"{{name}}"}</code> and{" "}
          <code className="font-mono">{"{{items}}"}</code> in the body below.
          Checkboxes use this browser only (per overnight window).
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/80 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">
          Email template
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Editable message copied per customer. Sizes use the variant / Size
          property when Shopify sends them; preview shows bold sizes for HTML
          paste.
        </p>
        <label htmlFor="overnight-email-template" className="sr-only">
          Email template
        </label>
        <textarea
          id="overnight-email-template"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          rows={14}
          spellCheck
          className="mt-3 w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-sm leading-relaxed text-foreground outline-none ring-sky-500/40 focus:border-sky-500 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900/80 dark:focus:border-sky-400"
        />

        {previewOrder ? (
          <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Preview ({previewOrder.customerName.trim() || "first order"})
            </p>
            <div className="mt-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/90 px-3 py-3 dark:border-zinc-600 dark:bg-zinc-900/40">
              <OvernightEmailPreview template={template} order={previewOrder} />
            </div>
          </div>
        ) : null}

        {copyMessage ? (
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
            {copyMessage}
            {copyDetail ? (
              <>
                {" "}
                <span className="text-zinc-500">—</span> {copyDetail}
              </>
            ) : null}
          </p>
        ) : null}
      </section>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/50">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            No orders in this window
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            When overnight checks clear, new orders will appear here after the next
            refresh.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((o) => {
            const flags = orderFlags[o.shopifyOrderId] ?? {
              complete: false,
              customerReplied: false,
            };
            return (
              <article
                key={o.shopifyOrderId}
                className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-4">
                  <div className="min-w-0 flex-1 flex-col gap-1">
                    <p className="font-semibold text-foreground">
                      {o.customerName.trim() || "—"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Hi line uses:{" "}
                      <span className="font-medium text-foreground">
                        {o.greetingName}
                      </span>
                    </p>
                    {o.email ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`mailto:${o.email}`}
                          className="break-all text-sm text-sky-800 underline decoration-sky-800/25 underline-offset-2 dark:text-sky-300"
                        >
                          {o.email}
                        </a>
                        <button
                          type="button"
                          onClick={() => onCopyAddress(o.email)}
                          className="shrink-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-foreground shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                        >
                          Copy address
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-zinc-500">No email</span>
                    )}
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={flags.complete}
                          onChange={(e) =>
                            setFlag(o.shopifyOrderId, "complete", e.target.checked)
                          }
                          className="size-4 rounded border-zinc-400 text-emerald-600 focus:ring-emerald-500"
                        />
                        COMPLETE
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={flags.customerReplied}
                          onChange={(e) =>
                            setFlag(
                              o.shopifyOrderId,
                              "customerReplied",
                              e.target.checked,
                            )
                          }
                          className="size-4 rounded border-zinc-400 text-violet-600 focus:ring-violet-500"
                        />
                        CUSTOMER REPLIED
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCopyMessage(o)}
                    className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                  >
                    Copy email
                  </button>
                </div>
                <ul className="mt-3 list-none space-y-1.5 border-t border-zinc-200/90 pt-3 dark:border-zinc-700/80">
                  {o.items.map((item, j) => (
                    <li
                      key={`${item.displayLine}-${j}`}
                      className="flex flex-wrap items-baseline gap-x-2 text-sm text-zinc-800 dark:text-zinc-200"
                    >
                      <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                        ×{item.quantity}
                      </span>
                      <span>{item.displayLine}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
