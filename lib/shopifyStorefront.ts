export const STOREFRONT_API_VERSION = "2025-04";

export type StorefrontGraphqlErrorItem = { message: string };

export class StorefrontGraphqlError extends Error {
  readonly graphqlErrors: readonly StorefrontGraphqlErrorItem[];
  readonly httpStatus: number;

  constructor(
    message: string,
    options: {
      graphqlErrors?: readonly StorefrontGraphqlErrorItem[];
      httpStatus?: number;
    } = {},
  ) {
    super(message);
    this.name = "StorefrontGraphqlError";
    this.graphqlErrors = options.graphqlErrors ?? [];
    this.httpStatus = options.httpStatus ?? 502;
  }
}

export type StorefrontGraphqlResponse<T> = {
  data?: T;
  errors?: StorefrontGraphqlErrorItem[];
};

export type StorefrontFetchOptions = {
  /** Overrides default `no-store` for this request only. */
  cache?: RequestCache;
  next?: { revalidate?: number; tags?: string[] };
};

function storefrontEndpoint(): string {
  const store = process.env.SHOPIFY_STORE?.trim();
  if (!store) {
    throw new StorefrontGraphqlError("SHOPIFY_STORE is not set", {
      httpStatus: 500,
    });
  }
  const host = store.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return `https://${host}/api/${STOREFRONT_API_VERSION}/graphql.json`;
}

function storefrontToken(): string {
  const token = process.env.SHOPIFY_STOREFRONT_TOKEN?.trim();
  if (!token) {
    throw new StorefrontGraphqlError("SHOPIFY_STOREFRONT_TOKEN is not set", {
      httpStatus: 500,
    });
  }
  return token;
}

/**
 * POST to Shopify Storefront GraphQL. Defaults to `cache: "no-store"` on the upstream fetch.
 */
export async function storefrontGraphql<
  TData,
  TVariables extends Record<string, unknown> = Record<string, unknown>,
>(
  query: string,
  variables?: TVariables,
  options?: StorefrontFetchOptions,
): Promise<TData> {
  const res = await fetch(storefrontEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": storefrontToken(),
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
    cache: options?.cache ?? "no-store",
    ...(options?.next ? { next: options.next } : {}),
  });

  const json = (await res.json().catch(() => ({}))) as StorefrontGraphqlResponse<TData>;

  if (!res.ok) {
    throw new StorefrontGraphqlError(
      `Storefront HTTP ${res.status}`,
      { httpStatus: res.status },
    );
  }

  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join("; ");
    throw new StorefrontGraphqlError(msg, {
      graphqlErrors: json.errors,
      httpStatus: 502,
    });
  }

  if (json.data === undefined || json.data === null) {
    throw new StorefrontGraphqlError("Empty Storefront GraphQL data", {
      httpStatus: 502,
    });
  }

  return json.data;
}
