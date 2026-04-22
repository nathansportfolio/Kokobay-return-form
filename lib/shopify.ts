let cachedToken: string | null = null;
let tokenExpiry = 0;

function requireShopifyEnv(): { store: string; clientId: string; clientSecret: string } {
  const store = process.env.SHOPIFY_STORE?.trim();
  const clientId = process.env.SHOPIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET?.trim();
  if (!store || !clientId || !clientSecret) {
    throw new Error(
      "Missing SHOPIFY_STORE, SHOPIFY_CLIENT_ID, or SHOPIFY_CLIENT_SECRET",
    );
  }
  return { store, clientId, clientSecret };
}

/**
 * Fetches a Shopify Admin API access token (client credentials) and caches it
 * until shortly before expiry. Used by server routes that call the Admin API.
 */
export async function getShopifyToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const { store, clientId, clientSecret } = requireShopifyEnv();

  const res = await fetch(
    `https://${store}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    },
  );

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!res.ok) {
    const msg = data.error ?? res.statusText;
    throw new Error(
      `Shopify token request failed: ${res.status} ${msg}`,
    );
  }

  const accessToken = data.access_token;
  if (!accessToken) {
    throw new Error("Shopify token response missing access_token");
  }

  const expiresIn =
    typeof data.expires_in === "number" && data.expires_in > 0
      ? data.expires_in
      : 24 * 60 * 60;

  cachedToken = accessToken;
  tokenExpiry = Date.now() + (expiresIn - 60) * 1000;

  return cachedToken;
}
