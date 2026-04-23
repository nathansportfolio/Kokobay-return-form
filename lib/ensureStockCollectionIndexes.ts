import type { MongoClient } from "mongodb";
import { kokobayDbName } from "@/lib/mongodb";
import { stockCollection } from "@/lib/warehouseStockTypes";

export async function ensureStockCollectionIndexes(
  client: MongoClient,
): Promise<void> {
  const c = stockCollection(client.db(kokobayDbName));
  for (const spec of await c.indexes()) {
    const key = spec.key as Record<string, number> | undefined;
    const n = key ? Object.keys(key).length : 0;
    if (
      spec.unique &&
      n === 1 &&
      key &&
      key.binCode === 1
    ) {
      const name = spec.name;
      if (name && name !== "_id_") {
        await c.dropIndex(name).catch(() => undefined);
      }
    }
  }
  await c.createIndex({ variantId: 1 }, { unique: true });
}
