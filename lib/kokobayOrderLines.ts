export type KokobayOrderLine = {
  id: string;
  sku: string;
  title: string;
  quantity: number;
  /** Unit price in GBP */
  unitPrice: number;
  /** Mock product photo (replace with your CDN when live) */
  imageUrl: string;
};

const CATALOG: Omit<KokobayOrderLine, "id" | "quantity">[] = [
  {
    sku: "KKB-W-DRESS-01",
    title: "KOKObay Linen Blend Midi Dress — Sage",
    unitPrice: 59.99,
    imageUrl:
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=256&h=256&fit=crop&q=80",
  },
  {
    sku: "KKB-W-KNIT-02",
    title: "KOKObay Ribbed Knit Cardigan — Cream",
    unitPrice: 45.0,
    imageUrl:
      "https://images.unsplash.com/photo-1581046535056-2588e55050c9?w=256&h=256&fit=crop&q=80",
  },
  {
    sku: "KKB-W-JEAN-03",
    title: "KOKObay High-Rise Straight Jeans — Indigo",
    unitPrice: 68.0,
    imageUrl:
      "https://images.unsplash.com/photo-1541099649102-f69e21d1533e?w=256&h=256&fit=crop&q=80",
  },
  {
    sku: "KKB-W-TOP-04",
    title: "KOKObay Satin Camisole Top — Black",
    unitPrice: 32.5,
    imageUrl:
      "https://images.unsplash.com/photo-1551489177-b4825a7717bc?w=256&h=256&fit=crop&q=80",
  },
  {
    sku: "KKB-W-COAT-05",
    title: "KOKObay Wool Blend Oversized Coat — Camel",
    unitPrice: 129.0,
    imageUrl:
      "https://images.unsplash.com/photo-1539533013717-bf7e40d20694?w=256&h=256&fit=crop&q=80",
  },
];

function hashOrderRef(ref: string): number {
  let h = 0;
  for (let i = 0; i < ref.length; i += 1) {
    h = (Math.imul(31, h) + ref.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Demo order lines for warehouse returns. Replace with a real fetch when your API is ready.
 */
export function getKokobayOrderLines(orderRef: string): KokobayOrderLine[] {
  const key = orderRef.trim().toUpperCase();
  const h = hashOrderRef(key);
  const count = 2 + (h % 3);
  const lines: KokobayOrderLine[] = [];
  for (let i = 0; i < count; i += 1) {
    const cat = CATALOG[(h + i * 7) % CATALOG.length];
    const qty = 1 + ((h >> (i + 1)) % 2);
    lines.push({
      id: `${key}-${cat.sku}-${i}`,
      sku: cat.sku,
      title: cat.title,
      quantity: qty,
      unitPrice: cat.unitPrice,
      imageUrl: cat.imageUrl,
    });
  }
  return lines;
}

export function formatGbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}
