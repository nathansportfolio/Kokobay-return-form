import { randomKokobayLocationForIndex } from "@/lib/kokobayLocationFormat";

export type WarehouseProduct = {
  sku: string;
  name: string;
  category: string;
  /** Display / filter colour, e.g. womens wear palette. */
  color: string;
  /** 256px-class thumbnail; may repeat across SKUs. */
  thumbnailImageUrl: string;
  /**
   * Place code: `A-02-D` = rack, bay, level (see `parseKokobayLocation`).
   * @see `randomKokobayLocationForIndex` / `POST /api/bins`
   */
  location: string;
  /** Unit sell price for mock orders / summaries (GB pence). */
  unitPricePence: number;
  quantityAvailable: number;
  seedTag: "kokobay-mock-v3";
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

const MOCK_COUNT = 200;

/** Common womens-wear / apparel colours for mock data. */
const WOMENS_WEAR_COLOURS = [
  "Black",
  "Navy",
  "Cream",
  "Blush",
  "Dusty rose",
  "Sage",
  "Charcoal",
  "Burgundy",
  "Ivory",
  "Stone",
  "Mocha",
  "Forest green",
  "Lilac",
  "Oat",
  "Terracotta",
  "Teal",
  "Camel",
  "Silver grey",
  "Coral",
  "Midnight blue",
  "Cocoa",
  "Aqua",
] as const;

/**
 * Unsplash: womens / fashion (cropped 256) — same URL may be reused; OK for mock.
 */
const WOMENS_WEAR_THUMBNAILS: string[] = [
  "https://images.unsplash.com/photo-1525507118888-4db3a9397070?w=256&h=256&fit=crop&q=80",
  "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=256&h=256&fit=crop&q=80",
  "https://images.unsplash.com/photo-1496747611176-843222e1a57a?w=256&h=256&fit=crop&q=80",
  "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=256&h=256&fit=crop&q=80",
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=256&h=256&fit=crop&q=80",
  "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=256&h=256&fit=crop&q=80",
  "https://images.unsplash.com/photo-1483988355255-087617d45ee1?w=256&h=256&fit=crop&q=80",
  "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=256&h=256&fit=crop&q=80",
  "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=256&h=256&fit=crop&q=80",
  "https://images.unsplash.com/photo-1504194104404-43360c07e3f2?w=256&h=256&fit=crop&q=80",
  "https://images.unsplash.com/photo-1445205170230-053b83016050?w=256&h=256&fit=crop&q=80",
  "https://images.unsplash.com/photo-1475180098004-ca77a66827be?w=256&h=256&fit=crop&q=80",
];

/** 200 mock women's products with the same v2 layout as `POST /api/bins` (A–U racks). */
export function buildMockWarehouseProducts(): WarehouseProduct[] {
  const out: WarehouseProduct[] = [];
  const now = new Date();
  for (let i = 0; i < MOCK_COUNT; i++) {
    const stem = PRODUCT_STEMS[i % PRODUCT_STEMS.length];
    const cat = WOMENS_CATEGORIES[i % WOMENS_CATEGORIES.length];
    const color = WOMENS_WEAR_COLOURS[i % WOMENS_WEAR_COLOURS.length];
    const location = randomKokobayLocationForIndex(i);
    const sku = `KB-MOCK-${String(i + 1).padStart(3, "0")}`;
    const unitPricePence = 1299 + ((i * 173) % 8000);
    const thumbnailImageUrl =
      WOMENS_WEAR_THUMBNAILS[i % WOMENS_WEAR_THUMBNAILS.length]!;
    out.push({
      sku,
      name: `${stem} — ${color}`,
      color,
      thumbnailImageUrl,
      category: cat,
      location,
      unitPricePence,
      quantityAvailable: 12 + (i % 40),
      seedTag: "kokobay-mock-v3",
      createdAt: now,
    });
  }
  return out;
}
