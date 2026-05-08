import { shopifyAdminGet } from "@/lib/shopifyAdminApi";

type AdminCollectionImage = {
  src?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
} | null;

type AdminCollection = {
  id: number;
  handle: string;
  title: string;
  body_html?: string | null;
  published_at?: string | null;
  image?: AdminCollectionImage;
};

type CustomCollectionsResponse = { custom_collections?: AdminCollection[] };
type SmartCollectionsResponse = { smart_collections?: AdminCollection[] };

export type KokobayCollectionJson = {
  id: string;
  handle: string;
  title: string;
  description?: string;
  descriptionHtml?: string;
  image?: {
    id?: string;
    url: string;
    altText?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
};

function stripHtml(html: string | null | undefined): string | undefined {
  if (!html) return undefined;
  const t = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return t || undefined;
}

function isPublished(c: AdminCollection): boolean {
  return Boolean(c.published_at);
}

function normalize(c: AdminCollection): KokobayCollectionJson {
  const id = `gid://shopify/Collection/${c.id}`;
  const src = c.image?.src?.trim();
  return {
    id,
    handle: c.handle,
    title: c.title,
    description: stripHtml(c.body_html ?? undefined),
    descriptionHtml: c.body_html ?? undefined,
    image: src
      ? {
          id: `gid://shopify/MediaImage/${c.id}`,
          url: src,
          altText: c.image?.alt ?? null,
          width: c.image?.width ?? null,
          height: c.image?.height ?? null,
        }
      : null,
  };
}

/**
 * `GET /api/collections` — active (published) custom + smart collections from Shopify Admin REST.
 * Same exposure model as `GET /api/products`: no API-key gate; site PIN + server env protect the app.
 */
export async function GET() {
  try {
    const [customRes, smartRes] = await Promise.all([
      shopifyAdminGet<CustomCollectionsResponse>("custom_collections.json?limit=250"),
      shopifyAdminGet<SmartCollectionsResponse>("smart_collections.json?limit=250"),
    ]);

    if (!customRes.ok && !smartRes.ok) {
      return Response.json(
        {
          error: "Shopify collections request failed",
          details: { custom: customRes.data, smart: smartRes.data },
          collections: [] as KokobayCollectionJson[],
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const byId = new Map<number, KokobayCollectionJson>();

    for (const c of customRes.data?.custom_collections ?? []) {
      if (!isPublished(c)) continue;
      byId.set(c.id, normalize(c));
    }
    for (const c of smartRes.data?.smart_collections ?? []) {
      if (!isPublished(c)) continue;
      if (!byId.has(c.id)) {
        byId.set(c.id, normalize(c));
      }
    }

    const collections = [...byId.values()].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
    );

    return Response.json(
      { collections },
      {
        headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message, collections: [] }, { status: 500 });
  }
}
