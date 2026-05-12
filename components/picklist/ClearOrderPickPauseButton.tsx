"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type Props = {
  pauseUid: string;
};

export function ClearOrderPickPauseButton({ pauseUid }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onClear = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/picklists/order-pause/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pauseUid }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErr(data.error ?? "Could not clear hold");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [pauseUid, router]);

  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => void onClear()}
        className="inline-flex min-h-9 items-center justify-center rounded-lg border border-emerald-600/80 bg-emerald-50 px-3 text-xs font-semibold text-emerald-950 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-500/70 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-900/60"
      >
        {busy ? "Clearing…" : "Clear hold — resume picking"}
      </button>
      {err ? (
        <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
      ) : null}
    </div>
  );
}
