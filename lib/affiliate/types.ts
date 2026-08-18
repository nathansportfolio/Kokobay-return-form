export type AffiliateRole = "admin" | "affiliate";

export type AffiliateDiscountType = "percentage" | "fixed_amount";

export type AffiliateRange = "7d" | "30d" | "90d";

/** Public account from Kokobay — never includes pin. */
export type AffiliateAccount = {
  id: string;
  code: string;
  displayName: string;
  discountCode: string;
  discountType: AffiliateDiscountType;
  discountValue: number;
  maxUsesPerCustomer: number | null;
  usageLimit: number | null;
  shopifyDiscountId: string | null;
  earningsPercent: number;
  role: AffiliateRole;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  payoutDetails?: AffiliatePayoutDetails | null;
};

export type AffiliatePayoutDetails = {
  legalName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postcode: string;
  country: string;
  accountName: string;
  sortCode: string;
  accountNumber: string;
  iban: string | null;
  updatedAt?: string;
};

export type AffiliateNavId =
  | "dashboard"
  | "clicks"
  | "codeUsage"
  | "orders"
  | "earnings"
  | "payments"
  | "profile";

export type AffiliateSeriesPoint = {
  date: string;
  value: number;
};

export type AffiliateDashboardData = {
  range: AffiliateRange;
  clicks: number;
  codeUses: number;
  orders: number;
  earnings: number;
  changePct: {
    clicks: number | null;
    codeUses: number | null;
    orders: number | null;
    earnings: number | null;
  };
  clicksSeries: AffiliateSeriesPoint[];
};

export type AffiliateOrderRow = {
  id: string;
  shopifyOrderId: string;
  orderName: string | null;
  discountCode: string;
  orderSubtotal: number;
  currency: string;
  earningsPercent: number;
  earning: number;
  orderedAt: string;
};

export type CreateAffiliateInput = {
  code: string;
  pin: string;
  displayName: string;
  discountCode: string;
  discountType: AffiliateDiscountType;
  discountValue: number;
  maxUsesPerCustomer: number | null;
  usageLimit: number | null;
  earningsPercent: number;
  role?: AffiliateRole;
};

export type AffiliatePayoutPeriod = {
  from: string;
  to: string;
  isOpen: boolean;
  label: string;
  paysAfter: string;
};

export type AffiliatePayoutRow = {
  id: string;
  affiliateId: string;
  amount: number;
  paidAt: string;
  note: string | null;
  recordedBy: {
    id: string;
    displayName: string;
  } | null;
  createdAt: string;
};

export type AffiliatePaymentsSummary = {
  period: AffiliatePayoutPeriod;
  periodEarnings: number;
  unpaidBalance: number;
  lifetimePaid: number;
  lastPaidAt: string | null;
  lastPaidAmount: number | null;
  payouts: AffiliatePayoutRow[];
  invoices: AffiliateInvoiceRow[];
};

export type AffiliateInvoiceRow = {
  id: string;
  invoiceNumber: string;
  affiliateId: string;
  affiliateCode: string;
  displayName: string;
  amount: number;
  currency: string;
  periodFrom: string;
  periodTo: string;
  periodLabel: string;
  payee: AffiliatePayoutDetails;
  issuedAt: string;
};

export type AffiliateAdminOverviewRow = AffiliateAccount & {
  clicks: number;
  orders: number;
  revenue: number;
  /** Unpaid commission (earnings since cycle start − payouts). */
  commissionOwed: number;
  periodEarnings?: number;
  lifetimePaid?: number;
  lastPaidAt?: string | null;
  lastPaidAmount?: number | null;
};

export type AffiliateOtherPaySlice = {
  label: string;
  affiliatePay: number;
  amount: number;
};

export type AffiliateAdminOverview = {
  period?: AffiliatePayoutPeriod;
  otherPay?: {
    ratePercent: number;
    current: AffiliateOtherPaySlice;
    previous: AffiliateOtherPaySlice | null;
  };
  totals: {
    clicks: number;
    revenue: number;
    commissionOwed: number;
    periodEarnings?: number;
    lifetimePaid?: number;
    orders: number;
    netRevenue: number;
    affiliateCount: number;
  };
  affiliates: AffiliateAdminOverviewRow[];
};
