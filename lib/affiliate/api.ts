import type {
  AffiliateAccount,
  AffiliateAdminOverview,
  AffiliateDashboardData,
  AffiliateInvoiceRow,
  AffiliateMonthlyDue,
  AffiliateOrderRow,
  AffiliatePaymentsSummary,
  AffiliatePayoutDetails,
  AffiliatePayoutRow,
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
    overview: {
      totals,
      affiliates,
      period: result.data.period,
      otherPay: result.data.otherPay,
    },
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

export async function updateAffiliateAccountPin(
  id: string,
  pin: string,
): Promise<{ ok: true; account: AffiliateAccount } | { ok: false; error: string }> {
  const result = await affiliateFetch<{ ok: true; account: AffiliateAccount }>(
    `/accounts/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ pin }),
    },
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

export async function fetchAffiliatePayments(): Promise<
  | { ok: true; data: AffiliatePaymentsSummary }
  | { ok: false; error: string }
> {
  const result = await affiliateFetch<AffiliatePaymentsSummary & { ok: true }>(
    "/payments",
  );
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      period: result.data.period,
      periodEarnings: result.data.periodEarnings,
      unpaidBalance: result.data.unpaidBalance,
      lifetimePaid: result.data.lifetimePaid,
      lastPaidAt: result.data.lastPaidAt,
      lastPaidAmount: result.data.lastPaidAmount,
      payouts: result.data.payouts ?? [],
      invoices: result.data.invoices ?? [],
      monthlyDues: result.data.monthlyDues ?? [],
    },
  };
}

export async function recordAffiliatePayout(input: {
  affiliateId: string;
  amount: number;
  note?: string;
  periodFrom?: string;
  invoiceId?: string;
}): Promise<
  | { ok: true; payout: AffiliatePayoutRow }
  | { ok: false; error: string }
> {
  const result = await affiliateFetch<{ ok: true; payout: AffiliatePayoutRow }>(
    "/admin/payouts",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  if (!result.ok) return result;
  return { ok: true, payout: result.data.payout };
}

export async function updateAffiliatePayoutDetails(
  input: Omit<AffiliatePayoutDetails, "updatedAt">,
): Promise<
  | { ok: true; account: AffiliateAccount }
  | { ok: false; error: string }
> {
  const result = await affiliateFetch<{
    ok: true;
    account: AffiliateAccount;
  }>("/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!result.ok) return result;
  return { ok: true, account: result.data.account };
}

export async function fetchAffiliateInvoicesForAdmin(
  affiliateId: string,
): Promise<
  | {
      ok: true;
      invoices: AffiliateInvoiceRow[];
      monthlyDues: AffiliateMonthlyDue[];
    }
  | { ok: false; error: string }
> {
  const result = await affiliateFetch<{
    ok: true;
    invoices: AffiliateInvoiceRow[];
    monthlyDues?: AffiliateMonthlyDue[];
  }>(`/admin/invoices?affiliateId=${encodeURIComponent(affiliateId)}`);
  if (!result.ok) return result;
  return {
    ok: true,
    invoices: result.data.invoices ?? [],
    monthlyDues: result.data.monthlyDues ?? [],
  };
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      return fallback;
    }
  }
  const plain = /filename="?([^"]+)"?/i.exec(header);
  return plain?.[1]?.trim() || fallback;
}

async function openAffiliatePdf(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true } | { ok: false; error: string }> {
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
    return { ok: false, error: "Could not reach affiliate API." };
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.includes("pdf")) {
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
    };
    return {
      ok: false,
      error: data.error ?? `Could not open invoice (${res.status})`,
    };
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const filename = filenameFromDisposition(
    res.headers.get("content-disposition"),
    "KOKO-BAY-invoice.pdf",
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { ok: true };
}

export async function openAffiliateInvoicePdf(
  invoiceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return openAffiliatePdf(`/invoices/${encodeURIComponent(invoiceId)}/pdf`);
}

export async function printAffiliateInvoice(
  affiliateId: string,
  periodFrom?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return openAffiliatePdf("/admin/invoices", {
    method: "POST",
    body: JSON.stringify({
      affiliateId,
      ...(periodFrom ? { periodFrom } : {}),
    }),
  });
}
