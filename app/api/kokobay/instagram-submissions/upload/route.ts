import { proxyKokobayPostFormData } from "@/lib/kokobayProxyForward";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const formData = await request.formData();
  return proxyKokobayPostFormData("/api/instagram-submissions/upload", formData);
}
