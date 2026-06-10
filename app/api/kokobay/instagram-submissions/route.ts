import {
  proxyKokobayGet,
  proxyKokobayPostJson,
} from "@/lib/kokobayProxyForward";

export const dynamic = "force-dynamic";

export async function GET() {
  return proxyKokobayGet("/api/instagram-submissions");
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxyKokobayPostJson("/api/instagram-submissions", body);
}
