import { proxyKokobayRequest } from "@/lib/kokobayProxyForward";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

async function forward(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  const segments = Array.isArray(path) ? path : [];
  if (segments.length === 0) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  const upstreamPath = `/api/affiliate/${segments.map(encodeURIComponent).join("/")}`;
  const incoming = new URL(request.url);
  return proxyKokobayRequest(request, upstreamPath, incoming.search);
}

export async function GET(request: Request, ctx: Ctx) {
  return forward(request, ctx);
}

export async function POST(request: Request, ctx: Ctx) {
  return forward(request, ctx);
}

export async function PATCH(request: Request, ctx: Ctx) {
  return forward(request, ctx);
}

export async function DELETE(request: Request, ctx: Ctx) {
  return forward(request, ctx);
}

export async function OPTIONS(request: Request, ctx: Ctx) {
  return forward(request, ctx);
}
