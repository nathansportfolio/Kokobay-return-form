import type {
  StorefrontCollectionDetail,
  StorefrontCollectionSummary,
  StorefrontFilter,
  StorefrontImage,
  StorefrontPredictiveSuggestion,
  StorefrontProduct,
  StorefrontProductPreview,
  StorefrontVariant,
} from "@/types/storefront";

type GqlMoney = { amount: string; currencyCode: string } | null | undefined;

function mapMoney(m: GqlMoney): { amount: string; currencyCode: string } | null {
  if (!m?.amount || !m.currencyCode) return null;
  return { amount: m.amount, currencyCode: m.currencyCode };
}

function mapImage(
  img:
    | {
        url?: string | null;
        altText?: string | null;
        width?: number | null;
        height?: number | null;
      }
    | null
    | undefined,
): StorefrontImage {
  if (!img?.url) return null;
  return {
    url: img.url,
    altText: img.altText ?? null,
    width: img.width ?? null,
    height: img.height ?? null,
  };
}

function mapVariant(node: {
  id?: string;
  title?: string;
  availableForSale?: boolean;
  price?: GqlMoney;
  compareAtPrice?: GqlMoney;
  selectedOptions?: { name: string; value: string }[];
}): StorefrontVariant | null {
  if (!node.id) return null;
  const price = mapMoney(node.price);
  if (!price) return null;
  return {
    id: node.id,
    title: node.title ?? "",
    availableForSale: Boolean(node.availableForSale),
    price,
    compareAtPrice: mapMoney(node.compareAtPrice),
    selectedOptions: node.selectedOptions ?? [],
  };
}

export function mapStorefrontProduct(
  node: Record<string, unknown> | null | undefined,
): StorefrontProduct | null {
  if (!node || typeof node !== "object") return null;
  const id = node.id as string | undefined;
  const title = node.title as string | undefined;
  const handle = node.handle as string | undefined;
  if (!id || !title || !handle) return null;

  const variantsConn = node.variants as
    | { edges?: { node?: Record<string, unknown> }[] }
    | undefined;
  const variants: StorefrontVariant[] = [];
  for (const e of variantsConn?.edges ?? []) {
    const v = mapVariant((e?.node ?? {}) as Parameters<typeof mapVariant>[0]);
    if (v) variants.push(v);
  }

  const pr = node.priceRange as
    | {
        minVariantPrice?: GqlMoney;
        maxVariantPrice?: GqlMoney;
      }
    | undefined;
  const minP = mapMoney(pr?.minVariantPrice);
  const maxP = mapMoney(pr?.maxVariantPrice);
  if (!minP || !maxP) return null;

  const cr = node.compareAtPriceRange as
    | {
        minVariantPrice?: GqlMoney;
        maxVariantPrice?: GqlMoney;
      }
    | undefined;

  return {
    id,
    title,
    handle,
    vendor: (node.vendor as string) ?? "",
    tags: (node.tags as string[]) ?? [],
    availableForSale: Boolean(node.availableForSale),
    featuredImage: mapImage(
      node.featuredImage as Parameters<typeof mapImage>[0],
    ),
    priceRange: { minVariantPrice: minP, maxVariantPrice: maxP },
    compareAtPriceRange: {
      minVariantPrice: mapMoney(cr?.minVariantPrice),
      maxVariantPrice: mapMoney(cr?.maxVariantPrice),
    },
    variants,
  };
}

export function mapStorefrontProductPreview(
  node: Record<string, unknown> | null | undefined,
): StorefrontProductPreview | null {
  const full = mapStorefrontProduct(node);
  if (!full) return null;
  return {
    id: full.id,
    title: full.title,
    handle: full.handle,
    vendor: full.vendor,
    availableForSale: full.availableForSale,
    featuredImage: full.featuredImage,
    priceRange: full.priceRange,
  };
}

export function mapCollectionDetail(
  c: Record<string, unknown> | null | undefined,
): StorefrontCollectionDetail | null {
  if (!c || typeof c !== "object") return null;
  const id = c.id as string | undefined;
  const handle = c.handle as string | undefined;
  const title = c.title as string | undefined;
  if (!id || !handle || !title) return null;
  return {
    id,
    handle,
    title,
    description: (c.description as string) ?? "",
    descriptionHtml: (c.descriptionHtml as string) ?? "",
    updatedAt: (c.updatedAt as string) ?? "",
    image: mapImage(c.image as Parameters<typeof mapImage>[0]),
  };
}

export function mapCollectionSummary(
  c: Record<string, unknown> | null | undefined,
): StorefrontCollectionSummary | null {
  if (!c || typeof c !== "object") return null;
  const id = c.id as string | undefined;
  const handle = c.handle as string | undefined;
  const title = c.title as string | undefined;
  if (!id || !handle || !title) return null;
  return {
    id,
    handle,
    title,
    image: mapImage(c.image as Parameters<typeof mapImage>[0]),
  };
}

export function mapStorefrontFilters(
  raw: unknown,
): StorefrontFilter[] {
  if (!Array.isArray(raw)) return [];
  const out: StorefrontFilter[] = [];
  for (const f of raw) {
    if (!f || typeof f !== "object") continue;
    const id = (f as { id?: string }).id;
    const label = (f as { label?: string }).label;
    const type = (f as { type?: string }).type;
    if (!id || !label || !type) continue;
    const valuesRaw = (f as { values?: unknown }).values;
    const values: StorefrontFilter["values"] = [];
    if (Array.isArray(valuesRaw)) {
      for (const v of valuesRaw) {
        if (!v || typeof v !== "object") continue;
        const vid = (v as { id?: string }).id;
        const vlabel = (v as { label?: string }).label;
        const count = (v as { count?: number }).count;
        const input = (v as { input?: string }).input;
        if (!vid || !vlabel || typeof count !== "number" || !input) continue;
        values.push({ id: vid, label: vlabel, count, input });
      }
    }
    out.push({ id, label, type, values });
  }
  return out;
}

export function mapPredictiveSuggestions(
  queries: unknown,
): StorefrontPredictiveSuggestion[] {
  if (!Array.isArray(queries)) return [];
  return queries
    .map((q) => {
      if (!q || typeof q !== "object") return null;
      const text = (q as { text?: string }).text;
      const styledText = (q as { styledText?: string }).styledText;
      if (!text || !styledText) return null;
      return { text, styledText };
    })
    .filter(Boolean) as StorefrontPredictiveSuggestion[];
}
