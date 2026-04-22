export type WarehouseProduct = {
  sku: string;
  name: string;
  category: string;
  /** e.g. "Row 2" */
  row: string;
  /** e.g. "Bin 4c" */
  bin: string;
  /** Unit sell price for mock orders / summaries (GB pence). */
  unitPricePence: number;
  quantityAvailable: number;
  seedTag: "kokobay-mock-v1";
  createdAt: Date;
};

const WOMENS_CATEGORIES = [
  "Women's Dresses",
  "Women's Tops",
  "Women's Knitwear",
  "Women's Jeans",
  "Women's Skirts",
  "Women's Outerwear",
  "Women's Activewear",
  "Women's Lingerie & Loungewear",
  "Women's Footwear",
  "Women's Accessories",
] as const;

const PRODUCT_STEMS = [
  "Linen wrap midi dress",
  "Ribbed tank top",
  "Merino crewneck sweater",
  "High-rise skinny jeans",
  "Pleated midi skirt",
  "Quilted puffer jacket",
  "Seamless sports bra",
  "Modal pyjama set",
  "Leather ankle boots",
  "Crossbody bag",
  "Satin slip dress",
  "Oversized shirt",
  "Cable-knit cardigan",
  "Wide-leg trousers",
  "Denim mini skirt",
  "Trench coat",
  "Leggings 7/8",
  "Lace bralette",
  "Canvas trainers",
  "Silk scarf",
  "Floral maxi dress",
  "Henley long-sleeve tee",
  "Fleece half-zip",
  "Boyfriend jeans",
  "A-line mini skirt",
  "Wool pea coat",
  "Running shorts",
  "Bodysuit",
  "Heeled mules",
  "Tote bag",
  "Shirt dress",
  "Crop hoodie",
  "V-neck jumper",
  "Straight-leg jeans",
  "Pencil skirt",
  "Parka with hood",
  "Yoga tank",
  "Camisole set",
  "Knee-high boots",
  "Bucket hat",
  "Tiered sundress",
  "Polo knit",
  "Zip-through hoodie",
  "Cropped flare jeans",
  "Wrap skirt",
  "Bomber jacket",
  "Track jacket",
  "Soft bra",
  "Espadrilles",
  "Clutch",
  "Bodycon midi dress",
  "Graphic tee",
  "Turtleneck sweater",
  "Mom jeans",
  "Denim skort",
  "Insulated coat",
  "Capri leggings",
  "Short robe",
  "Loafers",
  "Belt bag",
  "Smock dress",
  "Blouse with tie neck",
  "Shaker-stitch pullover",
  "Distressed jeans",
  "Midi slip skirt",
  "Lightweight mac",
  "Cycling shorts",
  "High-waist briefs",
  "Sandals",
  "Beanie",
] as const;

function locationForIndex(i: number): { row: string; bin: string } {
  const rowNum = (i % 8) + 1;
  const binSlot = i % 24;
  const letters = "ABCDEFGH";
  const letter = letters[Math.floor(binSlot / 3)] ?? "A";
  const num = (binSlot % 3) + 1;
  const suffix = i % 2 === 0 ? "c" : "a";
  return {
    row: `Row ${rowNum}`,
    bin: `Bin ${letter}${num}${suffix}`,
  };
}

/** Exactly 60 mock women's warehouse SKUs with row/bin locations. */
export function buildMockWarehouseProducts(): WarehouseProduct[] {
  const out: WarehouseProduct[] = [];
  const now = new Date();
  for (let i = 0; i < 60; i++) {
    const stem = PRODUCT_STEMS[i % PRODUCT_STEMS.length];
    const cat = WOMENS_CATEGORIES[i % WOMENS_CATEGORIES.length];
    const { row, bin } = locationForIndex(i);
    const sku = `KB-MOCK-${String(i + 1).padStart(3, "0")}`;
    const unitPricePence = 1299 + ((i * 173) % 8000);
    out.push({
      sku,
      name: `${stem} (${cat})`,
      category: cat,
      row,
      bin,
      unitPricePence,
      quantityAvailable: 12 + (i % 40),
      seedTag: "kokobay-mock-v1",
      createdAt: now,
    });
  }
  return out;
}
