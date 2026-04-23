import type { Db } from "mongodb";

/** One inventory row in Mongo `stock`: variant placed in a bin. */
export type StockDocument = {
  binCode: string;
  productId: number;
  variantId: number;
  sku: string;
  quantity: number;
  updatedAt: Date;
};

export const STOCK_COLLECTION = "stock";

export function stockCollection(db: Db) {
  return db.collection<StockDocument>(STOCK_COLLECTION);
}
