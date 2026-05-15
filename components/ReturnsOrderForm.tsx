"use client";

import { useState } from "react";
import {
  logReturnsOrderLookupClient,
  queryDiagnosticsForOrderString,
} from "@/lib/customerReturnOrderPreviewLog";
import { toast } from "sonner";

/**
 * Resolves the order in Shopify, then opens `/returns/{canonical order name}`.
 * The URL and UI always use Shopify’s `order.name` when lookup succeeds.
 */
export function ReturnsOrderForm() {
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = String(
      (e.currentTarget.elements.namedItem("orderNumber") as HTMLInputElement)
        ?.value ?? "",
    );
    const trimmed = raw.trim();
    if (trimmed.length < 2) {
      logReturnsOrderLookupClient("lookup_blocked_short_input", {
        orderInput: trimmed,
        orderInputLength: trimmed.length,
        queryDiagnostics: queryDiagnosticsForOrderString(trimmed),
      });
      toast.warning("Enter an order to look up", {
        description:
          "Use # and digits from the confirmation email, the order number, or the long id from order admin.",
      });
      return;
    }
    logReturnsOrderLookupClient("lookup_attempt", {
      orderInput: trimmed,
      orderInputLength: trimmed.length,
      queryDiagnostics: queryDiagnosticsForOrderString(trimmed),
    });
    setPending(true);
    try {
      const res = await fetch(
        `/api/returns/preview-order?order=${encodeURIComponent(trimmed)}`,
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        orderRef?: string;
        error?: string;
      };
      logReturnsOrderLookupClient("lookup_response", {
        orderInput: trimmed,
        queryDiagnostics: queryDiagnosticsForOrderString(trimmed),
        httpStatus: res.status,
        responseOk: res.ok,
        payloadOk: data.ok,
        orderRef: data.orderRef,
        error: data.error,
      });
      if (!res.ok || !data.ok || !data.orderRef) {
        toast.error(
          data.error ?? "We could not find that order. Check the value and try again.",
        );
        return;
      }
      const next = encodeURIComponent(data.orderRef);
      toast.success("Opening order in Shopify", {
        description: data.orderRef,
      });
      window.location.assign(`/returns/${next}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-950/40"
    >
      <div>
        <label
          htmlFor="order-number"
          className="block text-sm font-medium text-foreground"
        >
          Order
        </label>
        <p className="mt-1 text-xs text-zinc-500">
          We look it up in Shopify. Use the confirmation order name (e.g. #1001),
          the order number, or the long id from Shopify admin.
        </p>
        <input
          id="order-number"
          name="orderNumber"
          type="text"
          required
          minLength={2}
          enterKeyHint="go"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="e.g. #1001 or 12985108038018"
          defaultValue=""
          className="mt-2 w-full rounded-lg border border-zinc-300 bg-background px-3 py-2 text-base text-foreground outline-none ring-zinc-400 placeholder:text-zinc-400 focus:ring-2 sm:text-sm dark:border-zinc-600 dark:ring-zinc-500"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 active:opacity-90 enabled:hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Resolving in Shopify…" : "Open order return"}
      </button>
    </form>
  );
}
