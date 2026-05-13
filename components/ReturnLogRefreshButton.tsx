"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

/** Manual `router.refresh()` for return lists (e.g. after Shopify payment updates). */
export function ReturnLogRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onClick = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="inline-flex shrink-0 items-center rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
    >
      {isPending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
