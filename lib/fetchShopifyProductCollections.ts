import { SHOPIFY_ADMIN_API_VERSION } from "@/lib/shopifyAdminApi";
import { getShopifyToken } from "@/lib/shopify";

const BATCH_SIZE = 40;
/** Shopify caps connection page size (Admin GraphQL); max collections per product is also 250. */
const COLLECTIONS_PAGE = 250;

/**
 * Returns comma-separated collection **titles** per numeric product id (Admin GraphQL).
 * Empty string when none or on fetch failure for that batch.
 * Paginates so products in many collections don’t truncate after the first page.
 */
export async function fetchProductCollectionsByProductIds(
  productIds: number[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const uniq = [...new Set(productIds.filter((id) => id > 0))];
  if (uniq.length === 0) return map;

  const store = process.env.SHOPIFY_STORE?.trim();
  if (!store) return map;

  const token = await getShopifyToken();
  const url = `https://${store}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`;

  const batchQuery = `#graphql
    query ProductCollections($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          id
          collections(first: ${COLLECTIONS_PAGE}) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              title
            }
          }
        }
      }
    }
  `;

  const pageAfterQuery = `#graphql
    query ProductCollectionsAfter($id: ID!, $after: String!) {
      product(id: $id) {
        collections(first: ${COLLECTIONS_PAGE}, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            title
          }
        }
      }
    }
  `;

  async function appendPagedTitles(
    productGid: string,
    startAfter: string,
  ): Promise<string[]> {
    const extra: string[] = [];
    let after: string | null = startAfter;

    while (after) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": token,
          },
          body: JSON.stringify({
            query: pageAfterQuery,
            variables: { id: productGid, after },
          }),
        });
        const json = (await res.json()) as {
          data?: {
            product?: {
              collections?: {
                pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
                nodes?: Array<{ title?: string | null }>;
              };
            };
          };
          errors?: { message?: string }[];
        };
        if (!res.ok || json.errors?.length) {
          console.error(
            "Shopify GraphQL product collections (page):",
            json.errors?.map((e) => e.message).join("; ") ?? res.status,
          );
          break;
        }
        const coll = json.data?.product?.collections;
        const nodes = coll?.nodes ?? [];
        for (const n of nodes) {
          const t = String(n?.title ?? "").trim();
          if (t) extra.push(t);
        }
        if (!coll?.pageInfo?.hasNextPage) break;
        after = coll.pageInfo.endCursor ?? null;
        if (!after) break;
      } catch (e) {
        console.error("fetchProductCollections appendPagedTitles:", e);
        break;
      }
    }
    return extra;
  }

  for (let i = 0; i < uniq.length; i += BATCH_SIZE) {
    const chunk = uniq.slice(i, i + BATCH_SIZE);
    const ids = chunk.map((id) => `gid://shopify/Product/${id}`);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({ query: batchQuery, variables: { ids } }),
      });
      const json = (await res.json()) as {
        data?: {
          nodes?: Array<{
            id?: string;
            collections?: {
              pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
              nodes?: Array<{ title?: string | null }>;
            };
          } | null>;
        };
        errors?: { message?: string }[];
      };
      if (!res.ok || json.errors?.length) {
        console.error(
          "Shopify GraphQL product collections:",
          json.errors?.map((e) => e.message).join("; ") ?? res.status,
        );
        continue;
      }
      const nodes = json.data?.nodes ?? [];
      for (const node of nodes) {
        if (!node?.id) continue;
        const m = String(node.id).match(/Product\/(\d+)/);
        const pid = m ? Number(m[1]) : 0;
        if (!pid) continue;

        const titles = (node.collections?.nodes ?? [])
          .map((n) => String(n?.title ?? "").trim())
          .filter(Boolean);

        let allTitles = [...titles];
        const pg = node.collections?.pageInfo;
        if (pg?.hasNextPage && pg.endCursor) {
          const gid = `gid://shopify/Product/${pid}`;
          const more = await appendPagedTitles(gid, pg.endCursor);
          allTitles = allTitles.concat(more);
        }

        map.set(pid, allTitles.join(", "));
      }
    } catch (e) {
      console.error("fetchProductCollectionsByProductIds:", e);
    }
  }

  return map;
}
