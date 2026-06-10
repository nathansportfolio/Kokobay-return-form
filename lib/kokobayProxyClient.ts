/** Safe JSON parse for kokobay proxy responses (avoids empty-body .json() crashes). */
export async function readKokobayProxyJson<T>(
  res: Response,
  label: string,
): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[instagram-upload] ${label}: empty HTTP body`, {
        status: res.status,
        statusText: res.statusText,
        url: res.url,
      });
    }
    throw new Error(
      `${label} returned an empty response (${res.status}). The Kokobay API may be unavailable — try again shortly.`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const looksLikeHtml = /^\s*</.test(text);
    if (process.env.NODE_ENV !== "production") {
      console.error(`[instagram-upload] ${label}: invalid JSON`, {
        status: res.status,
        looksLikeHtml,
        preview: text.slice(0, 300),
      });
    }
    if (looksLikeHtml) {
      throw new Error(
        `${label} could not reach the Kokobay API (got a web page instead of JSON). If you are developing locally, set KOKOBAY_API_ORIGIN in .env.local — otherwise the latest Kokobay deploy may be required.`,
      );
    }
    throw new Error(`${label} returned invalid JSON (${res.status})`);
  }
}

export function kokobayProxyErrorMessage(
  data: { error?: string } | null | undefined,
  fallback: string,
): string {
  const msg = data?.error?.trim();
  return msg || fallback;
}
