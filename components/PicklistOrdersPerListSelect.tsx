"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const PARAM = "ordersPerList";

export function PicklistOrdersPerListSelect({
  value,
}: {
  value: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value;
      const p = new URLSearchParams(searchParams.toString());
      p.set(PARAM, next);
      router.push(`/picklists/today?${p.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <label className="flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
      <span className="font-medium">Max orders per pick list</span>
      <select
        name={PARAM}
        value={String(value)}
        onChange={onChange}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm font-semibold text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:focus:ring-zinc-500"
        aria-label="Maximum number of orders per pick list"
      >
        {OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
