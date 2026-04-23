import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { ensureProductCatalogSyncedForWarehouseDay } from "@/lib/shopifyProductCatalog";

/**
 * Daily Mongo catalog + `products` feed sync, non-blocking. Use only from
 * server (API routes) — not safe for the client bundle.
 * If the catalog is already fresh for the London day, this is a no-op.
 */
export function runProductCatalogSyncInBackgroundIfStale(): void {
  if (!process.env.SHOPIFY_STORE?.trim()) {
    return;
  }
  void (async () => {
    try {
      const c = await clientPromise;
      await ensureProductCatalogSyncedForWarehouseDay(c.db(kokobayDbName));
    } catch (e) {
      console.error(
        "[shopify product catalog] background auto-sync",
        e instanceof Error ? e.message : e,
      );
    }
  })();
}
