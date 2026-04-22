"use client";

import { useRef } from "react";
import { toast } from "sonner";

export function ReturnsOrderForm() {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw =
      inputRef.current?.value ??
      String(new FormData(e.currentTarget).get("orderNumber") ?? "");
    const trimmed = raw.trim();
    if (trimmed.length < 4) {
      toast.warning("Order number too short", {
        description: "Enter at least 4 characters.",
      });
      return;
    }
    const path = `/returns/${encodeURIComponent(trimmed)}`;
    toast.success("Opening return…", { description: trimmed });
    window.location.assign(path);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-950/40"
    >
      <div>
        <label
          htmlFor="order-number"
          className="block text-sm font-medium text-foreground"
        >
          Order number
        </label>
        <input
          ref={inputRef}
          id="order-number"
          name="orderNumber"
          type="text"
          enterKeyHint="go"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="e.g. 420420"
          defaultValue=""
          className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-background px-3 py-2 text-base text-foreground outline-none ring-zinc-400 placeholder:text-zinc-400 focus:ring-2 sm:text-sm dark:border-zinc-600 dark:ring-zinc-500"
        />
      </div>
      <button
        type="submit"
        className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 active:opacity-90"
      >
        Open order return
      </button>
    </form>
  );
}
