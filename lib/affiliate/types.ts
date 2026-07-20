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
