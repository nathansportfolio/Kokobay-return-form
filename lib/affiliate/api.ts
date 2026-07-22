import type {
  AffiliateAccount,
  AffiliateAdminOverview,
  AffiliateDashboardData,
  AffiliateOrderRow,
  AffiliateRange,
  AffiliateSeriesPoint,
  CreateAffiliateInput,
} from "@/lib/affiliate/types";

const TOKEN_KEY = "kokobay-affiliate-session-token";

export function readAffiliateSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeAffiliateSessionToken(token: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAffiliateSessionToken(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TOKEN_KEY);
}

type ApiErrorBody = { ok?: false; error?: string };

async function affiliateFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = readAffiliateSessionToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`/api/affiliate${path}`, {
      ...init,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Could not reach affiliate API.", status: 0 };
  }

  const data = (await res.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!res.ok || data.ok === false) {
    return {
      ok: false,
      error: data.error ?? `Request failed (${res.status})`,
      status: res.status,
    };
  }
  return { ok: true, data };
}

export function formatAffiliateDiscount(account: {
  discountType: "percentage" | "fixed_amount";
  discountValue: number;
}): string {
  if (account.discountType === "fixed_amount") {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(account.discountValue);
  }
  return `${account.discountValue}%`;
}

export function formatGbp(n: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(n);
}

export function formatInt(n: number): string {
  return new Intl.NumberFormat("en-GB").format(Math.round(n));
}

export function formatChangePct(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;
}

export function formatSeriesLabel(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

export async function affiliateLogin(
  code: string,
  pin: string,
): Promise<
  | { ok: true; account: AffiliateAccount; role: AffiliateAccount["role"] }
  | { ok: false; error: string }
> {
  const result = await affiliateFetch<{
    ok: true;
    role: AffiliateAccount["role"];
    account: AffiliateAccount;
    sessionToken: string;
  }>("/login", {
    method: "POST",
    body: JSON.stringify({ code, pin }),
  });
  if (!result.ok) return result;
  if (result.data.sessionToken) {
    writeAffiliateSessionToken(result.data.sessionToken);
  }
  return {
    ok: true,
    account: result.data.account,
    role: result.data.role,
  };
}

export async function affiliateLogout(): Promise<void> {
  await affiliateFetch("/logout", { method: "POST" });
  clearAffiliateSessionToken();
}

export async function affiliateMe(): Promise<
  | { ok: true; account: AffiliateAccount; role: AffiliateAccount["role"] }
  | { ok: false; error: string; status: number }
> {
  const result = await affiliateFetch<{
    ok: true;
    role: AffiliateAccount["role"];
    account: AffiliateAccount;
  }>("/me");
  if (!result.ok) return result;
  return {
    ok: true,
    account: result.data.account,
    role: result.data.role,
  };
}

export async function listAffiliateAccounts(): Promise<
  | { ok: true; accounts: AffiliateAccount[] }
  | { ok: false; error: string }
> {
  const result = await affiliateFetch<{ ok: true; accounts: AffiliateAccount[] }>(
    "/accounts",
  );
  if (!result.ok) return result;
  return { ok: true, accounts: result.data.accounts };
}

export async function fetchAffiliateAdminOverview(): Promise<
  | { ok: true; overview: AffiliateAdminOverview }
  | { ok: false; error: string }
> {
  const result = await affiliateFetch<AffiliateAdminOverview & { ok: true }>(
    "/admin/overview",
  );
  if (!result.ok) return result;
  const totals = result.data.totals;
  const affiliates = result.data.affiliates;
  if (!totals || !Array.isArray(affiliates)) {
    return {
      ok: false,
      error:
        "Admin overview is unavailable. Deploy the latest Kokobay API (GET /api/affiliate/admin/overview).",
    };
  }
  return {
    ok: true,
    overview: { totals, affiliates },
  };
}

export async function createAffiliateAccount(
  input: CreateAffiliateInput,
): Promise<
  | { ok: true; account: AffiliateAccount; warning?: string }
  | { ok: false; error: string }
> {
  const result = await affiliateFetch<{
    ok: true;
    account: AffiliateAccount;
    warning?: string;
  }>("/accounts", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!result.ok) return result;
  return {
    ok: true,
    account: result.data.account,
    warning: result.data.warning,
  };
}

export async function deleteAffiliateAccount(
  id: string,
): Promise<{ ok: true; account: AffiliateAccount } | { ok: false; error: string }> {
  const result = await affiliateFetch<{ ok: true; account: AffiliateAccount }>(
    `/accounts/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (!result.ok) return result;
  return { ok: true, account: result.data.account };
}

export async function fetchAffiliateDashboard(
  range: AffiliateRange,
): Promise<
  | { ok: true; data: AffiliateDashboardData }
  | { ok: false; error: string }
> {
  const result = await affiliateFetch<
    AffiliateDashboardData & { ok: true }
  >(`/dashboard?range=${encodeURIComponent(range)}`);
  if (!result.ok) return result;
  return { ok: true, data: result.data };
}

export async function fetchAffiliateClicks(range: AffiliateRange): Promise<
  | {
      ok: true;
      total: number;
      changePct: number | null;
      series: AffiliateSeriesPoint[];
    }
  | { ok: false; error: string }
> {
  const result = await affiliateFetch<{
    ok: true;
    total: number;
    changePct: number | null;
    series: AffiliateSeriesPoint[];
  }>(`/clicks?range=${encodeURIComponent(range)}`);
  if (!result.ok) return result;
  return {
    ok: true,
    total: result.data.total,
    changePct: result.data.changePct,
    series: result.data.series,
  };
}

export async function fetchAffiliateCodeUsage(range: AffiliateRange): Promise<
  | {
      ok: true;
      total: number;
      changePct: number | null;
      series: AffiliateSeriesPoint[];
    }
  | { ok: false; error: string }
> {
  const result = await affiliateFetch<{
    ok: true;
    total: number;
    changePct: number | null;
    series: AffiliateSeriesPoint[];
  }>(`/code-usage?range=${encodeURIComponent(range)}`);
  if (!result.ok) return result;
  return {
    ok: true,
    total: result.data.total,
    changePct: result.data.changePct,
    series: result.data.series,
  };
}

export async function fetchAffiliateOrders(range: AffiliateRange): Promise<
  | {
      ok: true;
      orders: AffiliateOrderRow[];
      totalOrders: number;
      totalEarnings: number;
    }
  | { ok: false; error: string }
> {
  const result = await affiliateFetch<{
    ok: true;
    orders: AffiliateOrderRow[];
    totalOrders: number;
    totalEarnings: number;
  }>(`/orders?range=${encodeURIComponent(range)}`);
  if (!result.ok) return result;
  return {
    ok: true,
    orders: result.data.orders,
    totalOrders: result.data.totalOrders,
    totalEarnings: result.data.totalEarnings,
  };
}

export async function fetchAffiliateEarnings(range: AffiliateRange): Promise<
  | {
      ok: true;
      earnings: number;
      orders: number;
      earningsPercent: number;
      changePct: number | null;
    }
  | { ok: false; error: string }
> {
  const result = await affiliateFetch<{
    ok: true;
    earnings: number;
    orders: number;
    earningsPercent: number;
    changePct: number | null;
  }>(`/earnings?range=${encodeURIComponent(range)}`);
  if (!result.ok) return result;
  return {
    ok: true,
    earnings: result.data.earnings,
    orders: result.data.orders,
    earningsPercent: result.data.earningsPercent,
    changePct: result.data.changePct,
  };
}
