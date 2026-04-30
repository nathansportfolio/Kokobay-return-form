"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const ORDER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const ORDERS_PARAM = "ordersPerList";
const ITEMS_PARAM = "itemsPerList";
const ITEM_OPTIONS = Array.from(
  { length: 100 },
  (_, i) => i + 1,
) as number[];

type Props = {
  ordersValue: number;
  itemsValue: number;
  listPath?: string;
};

export function PicklistOrdersPerListSelect({
  ordersValue,
  itemsValue,
  listPath = "/picklists/today",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParams = useCallback(
    (next: Partial<Record<typeof ORDERS_PARAM | typeof ITEMS_PARAM, string>>) => {
      const p = new URLSearchParams(searchParams.toString());
      if (next[ORDERS_PARAM] !== undefined) {
        p.set(ORDERS_PARAM, next[ORDERS_PARAM]!);
      }
      if (next[ITEMS_PARAM] !== undefined) {
        p.set(ITEMS_PARAM, next[ITEMS_PARAM]!);
      }
      router.push(`${listPath}?${p.toString()}`);
    },
    [listPath, router, searchParams],
  );

  const onOrdersChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setParams({ [ORDERS_PARAM]: e.target.value });
    },
    [setParams],
  );

  const onItemsChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setParams({ [ITEMS_PARAM]: e.target.value });
    },
    [setParams],
  );

  return (
    <div className="flex w-full min-w-0 flex-col items-stretch justify-end gap-2 sm:max-w-md sm:flex-row sm:items-end sm:gap-4 sm:pl-0">
      <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
        <span className="font-medium">Max orders per pick list</span>
        <select
          name={ORDERS_PARAM}
          value={String(ordersValue)}
          onChange={onOrdersChange}
          className="w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm font-semibold text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:focus:ring-zinc-500"
          aria-label="Maximum number of orders per pick list"
        >
          {ORDER_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
        <span className="font-medium">Max items (qty) per pick list</span>
        <select
          name={ITEMS_PARAM}
          value={String(itemsValue)}
          onChange={onItemsChange}
          className="w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm font-semibold text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:focus:ring-zinc-500"
          aria-label="Maximum total line quantity per pick list"
        >
          {ITEM_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
