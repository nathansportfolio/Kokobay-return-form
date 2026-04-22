import type { Metadata } from "next";
import Link from "next/link";
import { formatGbp } from "@/lib/kokobayOrderLines";
import { getWarehouseProductCatalog } from "@/lib/warehouseProductCatalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Product catalog",
  description: "Shopify products merged with warehouse DB; locations filled when possible",
};

export default async function ProductsPage() {
  const result = await getWarehouseProductCatalog();

  if (!result.ok) {
    return (
      <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold">Product catalog</h1>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {result.error} — check <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">SHOPIFY_*</code>{" "}
          env and the Shopify app token.
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          The catalog merges Admin API data with the <code className="text-xs">products</code> collection in Mongo; if
          Mongo is unavailable, only the error above applies to Shopify. Without Shopify, this page will not load.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-foreground underline"
        >
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Product catalog</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Shopify (live) merged with the warehouse database by SKU. Location, bin, and
          line follow Kokobay codes; if the DB is missing a row, has no SKU, or
          the stored location is invalid, a matching placeholder is shown (not
          saved to Mongo). Colour and stock use the DB when the SKU exists.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {result.rows.length} variant row{result.rows.length === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/50">
              <th className="px-2 py-2.5 sm:px-3" scope="col">
                Image
              </th>
              <th className="px-2 py-2.5 font-semibold sm:px-3" scope="col">
                SKU
              </th>
              <th className="px-2 py-2.5 font-semibold sm:px-3" scope="col">
                Product
              </th>
              <th className="px-2 py-2.5 font-semibold sm:px-3" scope="col">
                Variant
              </th>
              <th className="px-2 py-2.5 font-semibold sm:px-3" scope="col">
                Price
              </th>
              <th className="px-2 py-2.5 font-semibold sm:px-3" scope="col">
                Location
              </th>
              <th className="px-2 py-2.5 font-semibold sm:px-3" scope="col">
                Bin
              </th>
              <th className="px-2 py-2.5 font-semibold sm:px-3" scope="col">
                Stock
              </th>
              <th className="px-2 py-2.5 font-semibold sm:px-3" scope="col">
                Type / category
              </th>
              <th className="px-2 py-2.5 font-semibold sm:px-3" scope="col">
                Colour
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {result.rows.map((r) => (
              <tr
                key={r.key}
                className="text-zinc-800 dark:text-zinc-200"
              >
                <td className="px-2 py-2 sm:px-3">
                  {r.imageUrl ? (
                    <div className="relative h-11 w-11 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 dark:border-zinc-700">
                      {/* eslint-disable-next-line @next/next/no-img-element -- Shopify / arbitrary CDNs */}
                      <img
                        src={r.imageUrl}
                        alt=""
                        width={44}
                        height={44}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="h-11 w-11 rounded-md border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-600" />
                  )}
                </td>
                <td className="px-2 py-2 font-mono text-xs sm:px-3 sm:text-sm">
                  {r.sku}
                </td>
                <td className="min-w-[8rem] px-2 py-2 sm:px-3">
                  {r.productTitle}
                </td>
                <td className="max-w-xs truncate px-2 py-2 sm:px-3">
                  {r.variantTitle}
                </td>
                <td className="whitespace-nowrap px-2 py-2 sm:px-3">
                  {formatGbp(r.priceGbp)}
                </td>
                <td
                  className="px-2 py-2 sm:px-3"
                  title={r.locationLine}
                >
                  <div className="font-mono text-xs">{r.location}</div>
                  {r.locationFromDb ? null : (
                    <span
                      className="mt-0.5 block text-xs text-amber-700 dark:text-amber-400/90"
                    >
                      Placeholder
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 sm:px-3">{r.bin}</td>
                <td className="px-2 py-2 sm:px-3">
                  {r.stock}
                  {r.stockFromDb ? null : (
                    <span className="ml-1 text-xs text-zinc-500">(SH)</span>
                  )}
                </td>
                <td className="max-w-[8rem] truncate text-xs sm:px-3 sm:text-sm">
                  {r.category}
                </td>
                <td className="max-w-[6rem] truncate text-xs sm:px-3 sm:text-sm">
                  {r.color}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        (SH) = stock from Shopify inventory. Hover the location code for the full
        “Aisle, Bay, Shelf, Bin” line. Placeholder = no matching DB row, missing SKU, or
        non‑Kokobay location string in Mongo.
      </p>
    </div>
  );
}
