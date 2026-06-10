import { kokobayUpstreamOrigin, kokobayUpstreamUrl } from "@/lib/kokobayApiProxy";

function proxyErrorResponse(
  status: number,
  error: string,
  detail?: Record<string, unknown>,
) {
  console.error("[kokobay-proxy]", error, detail ?? "");
  return Response.json({ ok: false, error, ...detail }, { status });
}

/** Forward GET to kokobay; always return JSON on proxy/upstream failure. */
export async function proxyKokobayGet(path: string, search = ""): Promise<Response> {
  const url = kokobayUpstreamUrl(path, search);
  let upstream: Response;
  try {
    upstream = await fetch(url, { cache: "no-store" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return proxyErrorResponse(502, "Could not reach Kokobay API", {
      upstreamUrl: url,
      upstreamOrigin: kokobayUpstreamOrigin(),
      cause: message,
    });
  }

  const body = await upstream.text();
  if (!body.trim()) {
    return proxyErrorResponse(502, "Kokobay API returned an empty response", {
      upstreamUrl: url,
      upstreamStatus: upstream.status,
    });
  }

  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}

/** Forward POST with JSON body to kokobay. */
export async function proxyKokobayPostJson(
  path: string,
  body: string,
): Promise<Response> {
  const url = kokobayUpstreamUrl(path);
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return proxyErrorResponse(502, "Could not reach Kokobay API", {
      upstreamUrl: url,
      upstreamOrigin: kokobayUpstreamOrigin(),
      cause: message,
    });
  }

  const responseBody = await upstream.text();
  if (!responseBody.trim()) {
    return proxyErrorResponse(502, "Kokobay API returned an empty response", {
      upstreamUrl: url,
      upstreamStatus: upstream.status,
    });
  }

  return new Response(responseBody, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}

/** Forward POST multipart to kokobay. */
export async function proxyKokobayPostFormData(
  path: string,
  formData: FormData,
): Promise<Response> {
  const url = kokobayUpstreamUrl(path);
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      body: formData,
      cache: "no-store",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return proxyErrorResponse(502, "Could not reach Kokobay API", {
      upstreamUrl: url,
      upstreamOrigin: kokobayUpstreamOrigin(),
      cause: message,
    });
  }

  const responseBody = await upstream.text();
  if (!responseBody.trim()) {
    return proxyErrorResponse(502, "Kokobay API returned an empty response", {
      upstreamUrl: url,
      upstreamStatus: upstream.status,
    });
  }

  return new Response(responseBody, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}
