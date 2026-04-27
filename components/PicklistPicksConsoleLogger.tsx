"use client";

import { useEffect } from "react";
import type { TodaysPickListBatch } from "@/lib/picklistShared";

type Props = {
  dayKey: string;
  batches: TodaysPickListBatch[];
};

/**
 * Dev aid: logs pick batches when the server sends new props (after refresh / navigation).
 */
export function PicklistPicksConsoleLogger({ dayKey, batches }: Props) {
  useEffect(() => {
    // eslint-disable-next-line no-console -- intentional client debug
    console.log("[kokobay picks]", { dayKey, batches });
  }, [dayKey, batches]);
  return null;
}
