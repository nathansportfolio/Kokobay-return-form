"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface SkuMakerSearchHit {
  id: number;
  title: string;
  handle: string;
  status: string;
  vendor: string;
  productType: string;
  variantCount: number;
  imageUrl: string | null;
}

interface SkuMakerVariantProposal {
  variantId: number;
  option1: string;
  option2: string;
  option3: string;
  variantTitle: string;
  currentSku: string | null;
  currentIsCanonical: boolean;
  currentDuplicateOfOther: boolean;
  proposedSku: string;
  proposedDiffersFromCurrent: boolean;
  skipReason: string;
}

interface SkuMakerProductResult {
  id: number;
  title: string;
  handle: string;
  status: string;
  vendor: string;
  productType: string;
  imageUrl: string | null;
  displayTitle: string;
  variants: SkuMakerVariantProposal[];
  variantCount: number;
  changeCount: number;
  existingSkuCount: number;
}

interface SearchResponse {
  query: string;
  total: number;
  results: SkuMakerSearchHit[];
  error?: string;
}

interface ProductResponse {
  ok?: boolean;
  product?: SkuMakerProductResult;
  error?: string;
}

function StatusPill({ status }: { status: string }) {
  const norm = status.toLowerCase();
  const style =
    norm === "active"
      ? "bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-700/40"
      : norm === "draft"
        ? "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-700/40"
        : norm === "archived"
          ? "bg-zinc-100 text-zinc-700 ring-zinc-300 dark:bg-zinc-800/50 dark:text-zinc-300 dark:ring-zinc-600"
          : "bg-zinc-100 text-zinc-700 ring-zinc-300 dark:bg-zinc-800/50 dark:text-zinc-300 dark:ring-zinc-600";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ring-1 ring-inset ${style}`}
    >
      {norm || "unknown"}
    </span>
  );
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy fallback */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function SkuMakerClient() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchPending, setSearchPending] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<SkuMakerSearchHit[] | null>(null);
  const [shopTotal, setShopTotal] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [productPending, setProductPending] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [product, setProduct] = useState<SkuMakerProductResult | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const productRequestId = useRef(0);

  // Debounce the query for the search call.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 280);
    return () => window.clearTimeout(t);
  }, [query]);

  // Search whenever the debounced query (or refresh) changes.
  useEffect(() => {
    const ac = new AbortController();
    setSearchPending(true);
    setSearchError(null);
    void (async () => {
      try {
        const url =
          `/api/sku-maker/search?limit=30` +
          (debouncedQuery
            ? `&q=${encodeURIComponent(debouncedQuery)}`
            : "");
        const res = await fetch(url, { cache: "no-store", signal: ac.signal });
        const data = (await res.json()) as SearchResponse;
        if (ac.signal.aborted) return;
        if (!res.ok) {
          setResults(null);
          setSearchError(data.error ?? `Search failed (HTTP ${res.status})`);
          return;
        }
        setResults(data.results);
        setShopTotal(data.total);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setResults(null);
        setSearchError(e instanceof Error ? e.message : "Search failed");
      } finally {
        if (!ac.signal.aborted) setSearchPending(false);
      }
    })();
    return () => {
      ac.abort();
    };
  }, [debouncedQuery, refreshTick]);

  // Load product proposals when a product is selected.
  useEffect(() => {
    if (selectedId == null) {
      setProduct(null);
      setProductError(null);
      return;
    }
    const myId = ++productRequestId.current;
    const ac = new AbortController();
    setProductPending(true);
    setProductError(null);
    void (async () => {
      try {
        const url = `/api/sku-maker/product/${selectedId}${
          refreshTick > 0 ? "?refresh=1" : ""
        }`;
        const res = await fetch(url, { cache: "no-store", signal: ac.signal });
        const data = (await res.json()) as ProductResponse;
        if (myId !== productRequestId.current || ac.signal.aborted) return;
        if (!res.ok || !data.product) {
          setProduct(null);
          setProductError(data.error ?? `Load failed (HTTP ${res.status})`);
          return;
        }
        setProduct(data.product);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (myId !== productRequestId.current) return;
        setProduct(null);
        setProductError(e instanceof Error ? e.message : "Load failed");
      } finally {
        if (myId === productRequestId.current && !ac.signal.aborted) {
          setProductPending(false);
        }
      }
    })();
    return () => {
      ac.abort();
    };
  }, [selectedId, refreshTick]);

  const handleCopyOne = useCallback(async (sku: string) => {
    if (!sku) return;
    const ok = await copyToClipboard(sku);
    if (ok) {
      toast.success(`Copied ${sku}`);
    } else {
      toast.error("Could not copy to clipboard");
    }
  }, []);

  const handleCopyAll = useCallback(async () => {
    if (!product) return;
    const lines = product.variants
      .filter((v) => v.proposedSku)
      .map((v) => v.proposedSku);
    if (lines.length === 0) {
      toast.error("No proposed SKUs to copy.");
      return;
    }
    const ok = await copyToClipboard(lines.join("\n"));
    if (ok) {
      toast.success(`Copied ${lines.length} SKU(s)`);
    } else {
      toast.error("Could not copy to clipboard");
    }
  }, [product]);

  const handleCopyTsv = useCallback(async () => {
    if (!product) return;
    const header = ["Variant ID", "Size (Opt1)", "Colour (Opt2)", "Current SKU", "Proposed SKU"];
    const rows = product.variants.map((v) => [
      String(v.variantId),
      v.option1,
      v.option2,
      v.currentSku ?? "",
      v.proposedSku,
    ]);
    const out =
      [header, ...rows]
        .map((cols) =>
          cols
            .map((c) => c.replace(/\t/g, " ").replace(/\r?\n/g, " "))
            .join("\t"),
        )
        .join("\n") + "\n";
    const ok = await copyToClipboard(out);
    if (ok) {
      toast.success(`Copied ${rows.length} row(s) (TSV)`);
    } else {
      toast.error("Could not copy to clipboard");
    }
  }, [product]);

  const handleReload = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  const selectedHit = useMemo(
    () => results?.find((r) => r.id === selectedId) ?? null,
    [results, selectedId],
  );

  const adminUrl = useMemo(() => {
    if (!selectedId) return null;
    const store = process.env.NEXT_PUBLIC_SHOPIFY_ADMIN_HOSTNAME?.trim();
    if (store) {
      return `https://${store}/admin/products/${selectedId}`;
    }
    return null;
  }, [selectedId]);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          SKU Maker
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Search any Shopify product — including <strong>drafts</strong> and
          archived items — pick one, and we’ll show a canonical SKU per
          variant. Every proposal is checked against the rest of the shop so
          duplicates get an automatic <code className="font-mono text-xs">-1</code>,{" "}
          <code className="font-mono text-xs">-2</code>… suffix.
        </p>
        {shopTotal != null ? (
          <p className="mt-1 text-xs tabular-nums text-zinc-500">
            Loaded from Shopify: {shopTotal} product
            {shopTotal === 1 ? "" : "s"} (active + draft + archived). Cached for
            ~30 s.
          </p>
        ) : null}
      </header>

      <section aria-labelledby="sku-maker-search-heading" className="mb-6">
        <h2
          id="sku-maker-search-heading"
          className="mb-2 text-sm font-semibold text-foreground"
        >
          1. Find a product
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="sku-maker-search"
            type="search"
            name="sku-maker-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title, handle, vendor, tag, SKU, or product id…"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-zinc-600 dark:bg-zinc-900"
          />
          <button
            type="button"
            onClick={handleReload}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
            title="Re-fetch from Shopify (clears the 30s cache)"
          >
            Reload from Shopify
          </button>
        </div>
        {searchError ? (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            {searchError}
          </p>
        ) : null}
        <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
          {searchPending && !results ? (
            <p className="p-3 text-sm text-zinc-500">Searching…</p>
          ) : !results || results.length === 0 ? (
            <p className="p-3 text-sm text-zinc-500">
              {debouncedQuery
                ? "No products match this search."
                : "Start typing to search the full catalog."}
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {results.map((hit) => {
                const isSelected = hit.id === selectedId;
                return (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(hit.id)}
                      aria-pressed={isSelected}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "bg-sky-50 dark:bg-sky-950/40"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                      }`}
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 dark:border-zinc-700">
                        {hit.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- arbitrary Shopify CDN
                          <img
                            src={hit.imageUrl}
                            alt=""
                            width={40}
                            height={40}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {hit.title || hit.handle || `Product ${hit.id}`}
                          </span>
                          <StatusPill status={hit.status} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          <span className="font-mono">{hit.handle}</span>
                          {hit.productType ? ` · ${hit.productType}` : ""}
                          {hit.vendor ? ` · ${hit.vendor}` : ""}
                          {" · "}
                          {hit.variantCount} variant
                          {hit.variantCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-medium ${
                          isSelected
                            ? "text-sky-700 dark:text-sky-300"
                            : "text-zinc-500"
                        }`}
                      >
                        {isSelected ? "Selected" : "Select"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="sku-maker-result-heading">
        <h2
          id="sku-maker-result-heading"
          className="mb-2 text-sm font-semibold text-foreground"
        >
          2. Proposed SKUs
        </h2>
        {selectedId == null ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700">
            Pick a product above to see one proposed SKU per variant. Existing
            canonical SKUs are kept; everything else is regenerated and
            collision-checked across <em>all</em> products in the shop.
          </p>
        ) : productError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
            {productError}
          </p>
        ) : productPending && !product ? (
          <p className="rounded-lg border border-zinc-200 p-3 text-sm text-zinc-500 dark:border-zinc-700">
            Loading variants and computing SKUs…
          </p>
        ) : product ? (
          <ProductDetail
            product={product}
            adminUrl={adminUrl}
            selectedHit={selectedHit}
            onCopyOne={handleCopyOne}
            onCopyAll={handleCopyAll}
            onCopyTsv={handleCopyTsv}
            isReloading={productPending}
          />
        ) : null}
      </section>
    </div>
  );
}

function ProductDetail({
  product,
  adminUrl,
  selectedHit,
  onCopyOne,
  onCopyAll,
  onCopyTsv,
  isReloading,
}: {
  product: SkuMakerProductResult;
  adminUrl: string | null;
  selectedHit: SkuMakerSearchHit | null;
  onCopyOne: (sku: string) => void;
  onCopyAll: () => void;
  onCopyTsv: () => void;
  isReloading: boolean;
}) {
  const variants = product.variants;
  const skippedCount = variants.filter((v) => !v.proposedSku).length;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 dark:border-zinc-700">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary Shopify CDN
              <img
                src={product.imageUrl}
                alt=""
                width={48}
                height={48}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">
                {product.title}
              </h3>
              <StatusPill status={product.status} />
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              <span className="font-mono">{product.handle}</span>
              {product.productType ? ` · ${product.productType}` : ""}
              {product.vendor ? ` · ${product.vendor}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              <span className="text-zinc-400">SKU base name:</span>{" "}
              <span className="font-mono text-zinc-600 dark:text-zinc-300">
                {product.displayTitle || "(empty — uses handle)"}
              </span>
            </p>
            {selectedHit ? null : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {adminUrl ? (
            <a
              href={adminUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-xs font-medium text-sky-700 underline dark:text-sky-300"
            >
              Open in Shopify ↗
            </a>
          ) : null}
          <button
            type="button"
            onClick={onCopyAll}
            disabled={product.variants.every((v) => !v.proposedSku)}
            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 shadow-sm hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/80"
          >
            Copy SKUs
          </button>
          <button
            type="button"
            onClick={onCopyTsv}
            disabled={product.variants.length === 0}
            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 shadow-sm hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/80"
          >
            Copy TSV
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        {product.variantCount} variant
        {product.variantCount === 1 ? "" : "s"}
        {" · "}
        {product.changeCount} would change
        {skippedCount > 0 ? ` · ${skippedCount} skipped (missing options)` : ""}
        {" · "}
        deduped against {product.existingSkuCount} other SKU
        {product.existingSkuCount === 1 ? "" : "s"} in the shop
        {isReloading ? " · refreshing…" : ""}
      </p>

      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
          <thead className="bg-zinc-50/90 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/50">
            <tr>
              <th className="px-3 py-2 font-semibold" scope="col">
                Size (Opt 1)
              </th>
              <th className="px-3 py-2 font-semibold" scope="col">
                Colour (Opt 2)
              </th>
              <th className="px-3 py-2 font-semibold" scope="col">
                Current SKU
              </th>
              <th className="px-3 py-2 font-semibold" scope="col">
                Proposed SKU
              </th>
              <th className="px-3 py-2 font-semibold" scope="col">
                Notes
              </th>
              <th className="px-3 py-2 font-semibold" scope="col">
                <span className="sr-only">Copy</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {variants.map((v) => (
              <VariantRow key={v.variantId} v={v} onCopyOne={onCopyOne} />
            ))}
            {variants.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-3 text-sm text-zinc-500"
                >
                  This product has no variants.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VariantRow({
  v,
  onCopyOne,
}: {
  v: SkuMakerVariantProposal;
  onCopyOne: (sku: string) => void;
}) {
  const skipped = !v.proposedSku;
  const changed = v.proposedDiffersFromCurrent && !!v.proposedSku;
  return (
    <tr className="text-zinc-800 dark:text-zinc-200">
      <td className="px-3 py-2 align-top">
        {v.option1 ? (
          v.option1
        ) : (
          <span className="text-zinc-400">—</span>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        {v.option2 && v.option2.toLowerCase() !== "default" ? (
          v.option2
        ) : (
          <span className="text-zinc-400">{v.option2 || "—"}</span>
        )}
      </td>
      <td className="px-3 py-2 align-top font-mono text-xs sm:text-sm">
        {v.currentSku ? (
          <span
            className={
              v.currentDuplicateOfOther
                ? "text-red-700 dark:text-red-300"
                : v.currentIsCanonical
                  ? "text-zinc-700 dark:text-zinc-200"
                  : "text-amber-800 dark:text-amber-300"
            }
            title={
              v.currentDuplicateOfOther
                ? "Already used on another product — proposed SKU adds a -N suffix"
                : v.currentIsCanonical
                  ? "Already canonical — kept as-is"
                  : "Non-canonical — will be regenerated"
            }
          >
            {v.currentSku}
          </span>
        ) : (
          <span className="text-zinc-400">—</span>
        )}
      </td>
      <td className="px-3 py-2 align-top font-mono text-xs sm:text-sm">
        {skipped ? (
          <span className="text-zinc-400">—</span>
        ) : (
          <span
            className={
              changed
                ? "rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-700/40"
                : "text-zinc-700 dark:text-zinc-200"
            }
          >
            {v.proposedSku}
          </span>
        )}
      </td>
      <td className="px-3 py-2 align-top text-xs text-zinc-600 dark:text-zinc-300">
        {v.skipReason ? (
          <span className="text-amber-800 dark:text-amber-200/90">
            {v.skipReason}
          </span>
        ) : v.currentDuplicateOfOther ? (
          <span className="text-red-700 dark:text-red-300">
            Duplicate of another product — bumped with a numeric suffix.
          </span>
        ) : changed ? (
          v.currentSku ? (
            <span>Will replace the current value.</span>
          ) : (
            <span>New SKU (variant had none).</span>
          )
        ) : v.currentSku ? (
          <span className="text-zinc-500">No change needed.</span>
        ) : (
          <span className="text-zinc-500">—</span>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        {v.proposedSku ? (
          <button
            type="button"
            onClick={() => onCopyOne(v.proposedSku)}
            className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs font-medium text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
            aria-label={`Copy ${v.proposedSku}`}
          >
            Copy
          </button>
        ) : null}
      </td>
    </tr>
  );
}
