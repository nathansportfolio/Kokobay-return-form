"use client";

import { useRouter } from "next/navigation";
import {
  PICK_LIST_TB_ACTION,
  PICK_LIST_TB_SECONDARY,
} from "@/components/picklist/pickListToolbarClasses";

type Props = {
  /** e.g. "After changing stock in Mongo" */
  title?: string;
};

/**
 * Re-runs server components for the current page (no separate “pick cache” —
 * data comes from Shopify + Mongo each time this runs).
 */
export function PicklistRefreshButton({ title }: Props) {
  const router = useRouter();
  return (
    <button
      type="button"
      title={title}
      onClick={() => router.refresh()}
      className={`${PICK_LIST_TB_ACTION} ${PICK_LIST_TB_SECONDARY}`}
    >
      Refresh picks
    </button>
  );
}
