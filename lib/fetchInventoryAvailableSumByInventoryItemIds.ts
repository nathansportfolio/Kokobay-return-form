import { shopifyAdminGetNoCacheWithLink } from "@/lib/shopifyAdminApi";
import type { ShopifyVariant } from "@/types/shopify";

/** Admin REST allows up to 50 `inventory_item_ids` per request. */
const INVENTORY_ITEM_IDS_PER_REQUEST = 50;
const MAX_PAGES_PER_BATCH = 80;

type InventoryLevelsResponse = {
  inventory_levels?: Array<{
    inventory_item_id: number;
    available: number | null;
  }>;
};

function nextPageInfoFromLinkHeader(link: string | null): string | null {
  if (!link) return null;
  for (const segment of link.split(",")) {
    const m = segment.trim().match(/^<([^>]+)>\s*;\s*rel="next"/i);
    if (m) {
      try {
        return new URL(m[1]).searchParams.get("page_info");
      } catch {
        return null;
      }
    }
  }
  return null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function uniquePositiveIds(ids: number[]): number[] {
  return [
    ...new Set(ids.filter((n) => typeof n === "number" && Number.isFinite(n) && n > 0)),
  ];
}

async function fetchLevelsForInventoryItemIdBatch(
  ids: number[],
): Promise<NonNullable<InventoryLevelsResponse["inventory_levels"]>> {
  const out: NonNullable<InventoryLevelsResponse["inventory_levels"]> = [];
  let pageInfo: string | null = null;
  let isFirst = true;

  for (let guard = 0; guard < MAX_PAGES_PER_BATCH; guard += 1) {
    let path: string;
    if (isFirst) {
      const q = new URLSearchParams();
      q.set("limit", "250");
      q.set("inventory_item_ids", ids.join(","));
      path = `inventory_levels.json?${q.toString()}`;
      isFirst = false;
    } else {
      if (!pageInfo) break;
      const q = new URLSearchParams();
      q.set("limit", "250");
      q.set("page_info", pageInfo);
      path = `inventory_levels.json?${q.toString()}`;
    }

    const { ok, data, link } =
      await shopifyAdminGetNoCacheWithLink<InventoryLevelsResponse>(path);
    if (!ok) break;

    const batch = data?.inventory_levels ?? [];
    out.push(...batch);
    pageInfo = nextPageInfoFromLinkHeader(link);
    if (!pageInfo || batch.length === 0) break;
  }

  return out;
}

/**
 * REST `Variant.inventory_quantity` is often wrong or zero when **multi-location**
 * inventory is enabled. This loads {@link https://shopify.dev/docs/api/admin-rest/latest/resources/inventorylevel InventoryLevel}
 * rows and sums **`available`** across all locations per `inventory_item_id`.
 */
export async function fetchInventoryAvailableSumByInventoryItemIds(
  inventoryItemIds: number[],
): Promise<Map<number, number>> {
  const sums = new Map<number, number>();
  const ids = uniquePositiveIds(inventoryItemIds);
  for (const part of chunk(ids, INVENTORY_ITEM_IDS_PER_REQUEST)) {
    const levels = await fetchLevelsForInventoryItemIdBatch(part);
    for (const L of levels) {
      const id = L.inventory_item_id;
      const av = Math.max(0, Math.trunc(Number(L.available ?? 0)));
      sums.set(id, (sums.get(id) ?? 0) + av);
    }
  }
  return sums;
}

export function inventoryItemIdFromVariant(v: ShopifyVariant): number | null {
  const id = v.inventory_item_id;
  if (typeof id === "number" && Number.isFinite(id) && id > 0) {
    return id;
  }
  const loose = (v as unknown as { inventory_item_id?: number | string })
    .inventory_item_id;
  if (typeof loose === "string" && /^\d+$/.test(loose.trim())) {
    return Number(loose.trim());
  }
  return null;
}
