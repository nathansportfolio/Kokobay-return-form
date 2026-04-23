import type { Metadata } from "next";
import { getBinsLayoutTree } from "@/lib/getBinsLayoutTree";
import type { StockAtLocation } from "@/lib/getStockByBinCode";
import { getStockByBinCode } from "@/lib/getStockByBinCode";
import { WarehouseRacksClient } from "@/components/WarehouseRacksClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Warehouse layout",
  description: "Racks, bays, and levels (bin locations)",
};

export default async function WarehouseRacksPage() {
  const data = await getBinsLayoutTree();

  if (!data.ok) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Warehouse layout</h1>
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{data.error}</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Check MongoDB connection and <code className="text-xs">MONGODB_URI</code>.
        </p>
      </div>
    );
  }

  const { racks, totalBins, occupiedCount } = data;
  let stockByCode: Record<string, StockAtLocation[]> = {};
  try {
    stockByCode = await getStockByBinCode();
  } catch {
    stockByCode = {};
  }

  return (
    <WarehouseRacksClient
      racks={racks}
      totalBins={totalBins}
      occupiedCount={occupiedCount}
      stockByCode={stockByCode}
    />
  );
}
