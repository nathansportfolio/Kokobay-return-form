/**
 * Unsplash: women’s fashion (256 crop). Used when a line has no thumbnail or load fails.
 * @see next.config `images.unsplash.com` allowlist
 */
const WOMENS_FASHION_PLACEHOLDER_IMAGES: readonly string[] = [
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

function hash32(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

type PlaceholderKey = { step: number; sku: string; location: string };

/** Stable “random” women’s-fashion image per step (repeats for same key). */
export function womensFashionPlaceholderForStep(step: PlaceholderKey): string {
  const key = `${step.step}\t${step.sku}\t${step.location}`;
  const i = hash32(key) % WOMENS_FASHION_PLACEHOLDER_IMAGES.length;
  return WOMENS_FASHION_PLACEHOLDER_IMAGES[i]!;
}
