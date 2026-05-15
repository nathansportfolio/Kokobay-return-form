export type KokobayOrderLine = {
  id: string;
  /** Catalog / warehouse key: merchant variant SKU or `KOKO-VAR-{id}` (see `displaySkuForShopifyLineItem`). */
  sku: string;
  title: string;
  quantity: number;
  /** Unit price in GBP */
  unitPrice: number;
  /** Product image URL; empty if missing in DB (UI uses a placeholder). */
  imageUrl: string;
};

export function formatGbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}
