"use client";

import Link from "next/link";
import { PicklistRefreshButton } from "@/components/PicklistRefreshButton";
import {
  PICK_LIST_TB_ACTION,
  PICK_LIST_TB_SECONDARY,
} from "@/components/picklist/pickListToolbarClasses";

type Props = {
  /** e.g. after re-seeding stock */
  refreshTitle?: string;
};

/**
 * Common toolbar pair: re-fetch this page, then return to the pick type hub.
 */
export function PicklistRefreshAndAllTypes({
  refreshTitle = "Re-fetch from Shopify and Mongo (e.g. after re-seeding stock or editing locations)",
}: Props) {
  return (
    <div
      className="inline-flex flex-wrap items-center gap-2"
      aria-label="Refresh pick data and all pick list types"
    >
      <PicklistRefreshButton title={refreshTitle} />
      <Link
        href="/picklists"
        className={`${PICK_LIST_TB_ACTION} ${PICK_LIST_TB_SECONDARY}`}
      >
        All types
      </Link>
    </div>
  );
}
