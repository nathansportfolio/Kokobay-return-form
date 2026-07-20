import { kokobayUpstreamOrigin, kokobayUpstreamUrl } from "@/lib/kokobayApiProxy";

function proxyErrorResponse(
  status: number,
  error: string,
  detail?: Record<string, unknown>,
) {
  console.error("[kokobay-proxy]", error, detail ?? "");
  return Response.json({ ok: false, error, ...detail }, { status });
}

/** Rewrite upstream Set-Cookie so the browser stores it on this app's host. */
function rewriteSetCookieForProxy(setCookie: string, requestUrl: string): string {
  const isHttps = new URL(requestUrl).protocol === "https:";
  const parts = setCookie.split(";").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return setCookie;
  const [nameValue, ...attrs] = parts;
  const nextAttrs = attrs.filter((attr) => {
    const lower = attr.toLowerCase();
    if (lower.startsWith("domain=")) return false;
    if (lower === "secure") return isHttps;
    return true;
  });
  if (isHttps && !nextAttrs.some((a) => a.toLowerCase() === "secure")) {
    nextAttrs.push("Secure");
  }
  return [nameValue, ...nextAttrs].join("; ");
}

/**
 * Forward any method to kokobay, preserving Cookie / Authorization and
 * rewriting Set-Cookie onto this origin (for affiliate session cookies).
 */
export async function proxyKokobayRequest(
  request: Request,
  path: string,
  search = "",
): Promise<Response> {
  const url = kokobayUpstreamUrl(path, search);
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);

  const method = request.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };
  if (method !== "GET" && method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return proxyErrorResponse(502, "Could not reach Kokobay API", {
      upstreamUrl: url,
      upstreamOrigin: kokobayUpstreamOrigin(),
      cause: message,
    });
  }

  const responseBody = await upstream.arrayBuffer();
  const outHeaders = new Headers();
  const upstreamContentType = upstream.headers.get("content-type");
  if (upstreamContentType) {
    outHeaders.set("Content-Type", upstreamContentType);
  } else {
    outHeaders.set("Content-Type", "application/json");
  }
  outHeaders.set("Cache-Control", "no-store");

  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) outHeaders.set("Retry-After", retryAfter);

  const getSetCookie = (
    upstream.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.();
  if (getSetCookie && getSetCookie.length > 0) {
    for (const raw of getSetCookie) {
      outHeaders.append(
        "Set-Cookie",
        rewriteSetCookieForProxy(raw, request.url),
      );
    }
  } else {
    const single = upstream.headers.get("set-cookie");
    if (single) {
      outHeaders.append(
        "Set-Cookie",
        rewriteSetCookieForProxy(single, request.url),
      );
    }
  }

  return new Response(responseBody, {
    status: upstream.status,
    headers: outHeaders,
  });
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
