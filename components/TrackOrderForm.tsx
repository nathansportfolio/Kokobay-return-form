"use client";

import { MagnifyingGlass, Package, Truck } from "@phosphor-icons/react";
import { useState } from "react";

import { TRACK_ORDER_PAGE_COPY } from "@/lib/trackOrderPageContent";
import type { TrackOrderSuccessResponse } from "@/types/trackOrder";

type TrackOrderApiResponse =
  | TrackOrderSuccessResponse
  | { ok: false; error: string; code?: string };

const CARD_CLASS =
  "rounded-2xl border border-zinc-200/90 bg-white p-5 text-zinc-900 shadow-[0_4px_28px_-6px_rgba(0,0,0,0.08)] sm:p-6 dark:border-zinc-700/60 dark:bg-zinc-950 dark:text-zinc-50 dark:shadow-[0_4px_28px_-6px_rgba(0,0,0,0.35)]";

const INPUT_CLASS =
  "mt-1.5 min-h-12 w-full rounded-lg border border-zinc-300 bg-background px-3 py-2.5 text-base text-foreground outline-none ring-zinc-400 placeholder:text-zinc-400 focus:ring-2 sm:min-h-10 sm:py-2 sm:text-sm dark:border-zinc-600 dark:ring-zinc-500";

export function TrackOrderForm() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackOrderSuccessResponse | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/track-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, email }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        setError(
          res.status === 404
            ? "Order tracking is not available on this site yet. Please try again later."
            : "Could not look up your order. Please try again.",
        );
        return;
      }
      const data = (await res.json()) as TrackOrderApiResponse;
      if (!res.ok || !data.ok) {
        setError(
          !data.ok
            ? data.error
            : "We couldn't find an order matching those details.",
        );
        return;
      }
      setResult(data);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const fulfilled =
    result != null &&
    !result.status.toLowerCase().includes("unfulfilled") &&
    result.status.toLowerCase() !== "processing";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 text-zinc-800 sm:space-y-8 dark:text-zinc-200">
      <header className="text-center sm:text-left">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 sm:mx-0 dark:bg-zinc-900">
          <Package className="h-7 w-7 text-zinc-700 dark:text-zinc-200" weight="duotone" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {TRACK_ORDER_PAGE_COPY.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          {TRACK_ORDER_PAGE_COPY.intro}
        </p>
      </header>

      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        className={CARD_CLASS}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="track-order-number" className="text-sm font-medium text-foreground">
              Order number
            </label>
            <input
              id="track-order-number"
              name="orderNumber"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="62127"
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              className={INPUT_CLASS}
              required
            />
          </div>
          <div>
            <label htmlFor="track-order-email" className="text-sm font-medium text-foreground">
              Email address
            </label>
            <input
              id="track-order-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={INPUT_CLASS}
              required
            />
          </div>
        </div>

        {error ? (
          <p
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity enabled:hover:opacity-90 disabled:opacity-50"
        >
          <MagnifyingGlass className="h-4 w-4" weight="bold" aria-hidden />
          {busy ? "Looking up…" : "Track order"}
        </button>
      </form>

      {result ? (
        <section className={CARD_CLASS} aria-live="polite">
          <h2 className="text-lg font-semibold text-foreground">
            Order #{result.orderNumber}
          </h2>

          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  fulfilled
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900"
                }`}
                aria-hidden
              >
                {fulfilled ? "✓" : "·"}
              </span>
              <span className="font-medium text-foreground">{result.status}</span>
            </li>
            <li className="flex items-center gap-2">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  result.onItsWay
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900"
                }`}
                aria-hidden
              >
                {result.onItsWay ? "✓" : "·"}
              </span>
              <span className="font-medium text-foreground">On its way</span>
            </li>
          </ul>

          <dl className="mt-5 space-y-3 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800">
            {result.carrier ? (
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-zinc-500">Carrier</dt>
                <dd className="font-medium text-foreground">{result.carrier}</dd>
              </div>
            ) : null}
            {result.trackingNumber ? (
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-zinc-500">Tracking number</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  {result.trackingUrl ? (
                    <a
                      href={result.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      {result.trackingNumber}
                    </a>
                  ) : (
                    result.trackingNumber
                  )}
                </dd>
              </div>
            ) : null}
          </dl>

          {result.trackingUrl ? (
            <a
              href={result.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              <Truck className="h-4 w-4" weight="bold" aria-hidden />
              Track parcel
            </a>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
