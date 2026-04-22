export type WarehouseOrderLine = {
  sku: string;
  quantity: number;
  name: string;
  row: string;
  bin: string;
  /** GB pence; optional on older seeded docs — summaries use a stable fallback. */
  unitPricePence?: number;
};

export type WarehouseOrder = {
  orderNumber: string;
  status: "pending";
  items: WarehouseOrderLine[];
  createdAt: Date;
  seedTag: "kokobay-mock-orders-v1";
};

type ProductPick = {
  sku: string;
  name: string;
  row: string;
  bin: string;
  unitPricePence?: number;
};

/** Deterministic: each value in 1..10 inclusive, varied across 30 orders. */
export function lineCountsForThirtyOrders(): number[] {
  return Array.from({ length: 30 }, (_, i) => ((i * 11 + 3) % 10) + 1);
}

function shuffleInPlace<T>(arr: T[], seed: number): void {
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/**
 * Build 30 mock orders; each line uses SKUs and snapshot fields from `products`.
 * If an order needs more lines than unique products, SKUs may repeat after reshuffling.
 */
export function buildMockOrdersFromProducts(
  products: ProductPick[],
  seed = 42_001,
): WarehouseOrder[] {
  if (products.length === 0) {
    throw new Error("No products to build orders from");
  }

  const pool = products.map((p) => ({ ...p }));
  const counts = lineCountsForThirtyOrders();
  const now = new Date();
  const orders: WarehouseOrder[] = [];

  for (let o = 0; o < 30; o++) {
    const n = counts[o] ?? 1;
    shuffleInPlace(pool, seed + o * 997);
    const items: WarehouseOrderLine[] = [];
    for (let k = 0; k < n; k++) {
      const p = pool[k % pool.length]!;
      items.push({
        sku: p.sku,
        quantity: 1 + ((o + k * 5) % 3),
        name: p.name,
        row: p.row,
        bin: p.bin,
        unitPricePence: p.unitPricePence,
      });
    }
    orders.push({
      orderNumber: `KB-ORD-${String(o + 1).padStart(5, "0")}`,
      status: "pending",
      items,
      createdAt: now,
      seedTag: "kokobay-mock-orders-v1",
    });
  }

  return orders;
}
