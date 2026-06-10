import { proxyKokobayGet } from "@/lib/kokobayProxyForward";

export const dynamic = "force-dynamic";

/** Proxy GET /api/search on kokobay (Storefront product search). */
export async function GET(request: Request) {
  const incoming = new URL(request.url);
  return proxyKokobayGet("/api/search", incoming.search);
}
