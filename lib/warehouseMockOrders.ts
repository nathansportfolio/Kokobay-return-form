export type WarehouseOrderLine = {
  sku: string;
  quantity: number;
  name: string;
  /** Copied from product at order build time, when available. */
  color?: string;
  thumbnailImageUrl?: string;
  /** e.g. `B-04-C3` (see `kokobayLocationFormat`) */
  location: string;
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
  color?: string;
  thumbnailImageUrl?: string;
  location: string;
  unitPricePence?: number;
};

/**
 * 30 line counts, each 2–5 (max five lines per order). Heavier on 2–3 so the
 * average is ~2–3; a few 4s and 5s. Shuffled for variety across order numbers.
 */
export function lineCountsForThirtyOrders(): number[] {
  const multiset: number[] = [
    ...Array(14).fill(2),
    ...Array(10).fill(3),
    ...Array(4).fill(4),
    ...Array(2).fill(5),
  ];
  shuffleInPlace(multiset, 90_001);
  return multiset;
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
        color: p.color,
        thumbnailImageUrl: p.thumbnailImageUrl,
        location: p.location,
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
