import type { Metadata } from "next";
import { StockExposureDashboard } from "@/components/admin/StockExposureDashboard";
import { getStockExposureAnalytics } from "@/lib/stockExposureAnalytics";

export const metadata: Metadata = {
  title: "Stock exposure",
  description:
    "Analytics for productStockLookups: OOS / low-stock exposure and UTM attribution (Europe/London).",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ range?: string }>;
};

export default async function StockExposurePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const data = await getStockExposureAnalytics(sp.range);
  return <StockExposureDashboard data={data} />;
}
