/** Same-origin proxy paths — browser calls these; server forwards to kokobay. */
export function kokobayProxySearchApi(query: Record<string, string>): string {
  const params = new URLSearchParams(query);
  return `/api/kokobay/search?${params.toString()}`;
}

export function kokobayProxyInstagramSubmissionsApi(path = ""): string {
  const suffix = path.startsWith("/") ? path : path ? `/${path}` : "";
  return `/api/kokobay/instagram-submissions${suffix}`;
}
