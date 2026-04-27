"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Skeleton from "@mui/material/Skeleton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { catalogSkuForVariant } from "@/lib/shopifyCanonicalVariantSku";
import type { ShopifyProduct, ShopifyVariant } from "@/types/shopify";

type Queued = {
  productId: number;
  variantId: number;
  sku: string;
  productTitle: string;
  variantTitle: string;
  quantity: number;
  /** `inventory_quantity` in the list response (hint only). */
  shopifyOnHand: number;
};

type FlatVariant = {
  product: ShopifyProduct;
  variant: ShopifyVariant;
  sku: string;
};

function defaultQuantityFromShopifyOnHand(
  v: Pick<ShopifyVariant, "inventory_quantity">,
): number {
  const n = Math.trunc(Number(v.inventory_quantity));
  if (!Number.isFinite(n) || n < 1) {
    return 1;
  }
  return Math.min(9_999, n);
}

function flattenProducts(products: ShopifyProduct[]): FlatVariant[] {
  const out: FlatVariant[] = [];
  for (const p of products) {
    for (const v of p.variants ?? []) {
      if (!Number.isFinite(v.id) || !Number.isFinite(p.id)) continue;
      out.push({ product: p, variant: v, sku: catalogSkuForVariant(v).sku });
    }
  }
  return out;
}

const NORMALIZE_PUNCT = /[,'"\u2018\u2019\u201c\u201d.:/!()[\]{}\-–—_]/g;

function normalizeForSearch(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(NORMALIZE_PUNCT, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchTokens(query: string): string[] {
  const t = query.normalize("NFC").trim();
  if (!t) return [];
  return t
    .toLowerCase()
    .replace(NORMALIZE_PUNCT, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function productSearchText(row: FlatVariant): string {
  const p = row.product;
  return normalizeForSearch(
    [
      p.title,
      p.handle ?? "",
      p.vendor ?? "",
      p.product_type ?? "",
      typeof p.tags === "string" ? p.tags : "",
      row.variant.title ?? "",
      row.sku,
      String(p.id),
      String(row.variant.id),
    ].join(" "),
  );
}

function matchesSearch(row: FlatVariant, rawQuery: string): boolean {
  const q = rawQuery.trim();
  if (!q) return true;
  const text = productSearchText(row);
  const tokens = searchTokens(q);
  if (tokens.length > 0) {
    return tokens.every((w) => text.includes(w));
  }
  const phrase = normalizeForSearch(q);
  return phrase.length > 0 && text.includes(phrase);
}

export function AddProductsToBinDialog({
  open,
  binCode,
  onClose,
  onSuccess,
}: {
  open: boolean;
  binCode: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<FlatVariant[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [queue, setQueue] = useState<Queued[]>([]);

  const reset = useCallback(() => {
    setSearch("");
    setQueue([]);
    setLoadError(null);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const res = await fetch("/api/products?all=1", { cache: "no-store" });
        const data = (await res.json()) as
          | { products?: ShopifyProduct[]; error?: string };
        if (!res.ok) {
          setLoadError(
            typeof data === "object" && data && "error" in data
              ? String((data as { error?: string }).error)
              : "Request failed",
          );
          setItems(null);
          return;
        }
        const products = Array.isArray(data.products) ? data.products : [];
        setItems(flattenProducts(products));
      } catch {
        setLoadError("Failed to load products");
        setItems(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, reset]);

  const filtered = useMemo(() => {
    if (!items?.length) return [];
    const q = search.trim();
    if (!q) {
      return items.slice(0, 80);
    }
    return items
      .filter((row) => matchesSearch(row, q))
      .slice(0, 100);
  }, [items, search]);

  const queueVariantIds = useMemo(
    () => new Set(queue.map((q) => q.variantId)),
    [queue],
  );

  const addToQueue = useCallback(
    (row: FlatVariant) => {
      const { product, variant, sku } = row;
      setQueue((prev) => {
        const ex = prev.find((p) => p.variantId === variant.id);
        if (ex) {
          return prev.map((p) =>
            p.variantId === variant.id
              ? { ...p, quantity: p.quantity + 1 }
              : p,
          );
        }
        const q0 = defaultQuantityFromShopifyOnHand(variant);
        const invRaw = Math.trunc(Number(variant.inventory_quantity));
        return [
          ...prev,
          {
            productId: product.id,
            variantId: variant.id,
            sku,
            productTitle: product.title,
            variantTitle: variant.title || "Default",
            quantity: q0,
            shopifyOnHand: Number.isFinite(invRaw) ? invRaw : 0,
          },
        ];
      });
    },
    [setQueue],
  );

  const setQueuedQty = (variantId: number, quantity: number) => {
    const q = Math.max(1, Math.min(9_999, Math.trunc(quantity)) || 1);
    setQueue((prev) =>
      prev.map((p) => (p.variantId === variantId ? { ...p, quantity: q } : p)),
    );
  };

  const removeQueued = (variantId: number) => {
    setQueue((prev) => prev.filter((p) => p.variantId !== variantId));
  };

  const submit = async () => {
    if (queue.length === 0) {
      toast.error("Add at least one product");
      return;
    }
    setSubmitting(true);
    try {
      const lines = queue.map((q) => ({
        productId: q.productId,
        variantId: q.variantId,
        sku: q.sku,
        quantity: q.quantity,
      }));
      const res = await fetch("/api/stock/line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ binCode, lines }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Could not add stock");
        return;
      }
      toast.success("Stock updated");
      onSuccess();
      onClose();
    } catch {
      toast.error("Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="md"
      fullWidth
      scroll="body"
      aria-labelledby="add-products-bin-title"
    >
      <DialogTitle id="add-products-bin-title" sx={{ pb: 0.5 }}>
        Add products
        {binCode ? (
          <span className="ml-2 font-mono text-base font-medium text-zinc-600 dark:text-zinc-400">
            {binCode}
          </span>
        ) : null}
      </DialogTitle>
      <DialogContent sx={{ pt: 0.5, pb: 0, overflow: "visible" }}>
        {loadError ? (
          <p className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
        ) : null}
        {loading ? (
          <div className="space-y-3" aria-hidden>
            <Skeleton variant="rounded" height={40} className="w-full" />
            <div className="max-h-52 space-y-0 overflow-hidden rounded-md border border-zinc-200/90 p-2 dark:border-zinc-700/90">
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 border-b border-zinc-100 py-2.5 last:border-0 dark:border-zinc-800"
                >
                  <div className="min-w-0 flex-1 space-y-1.5 pr-2">
                    <Skeleton variant="text" width="85%" height={20} />
                    <Skeleton variant="text" width="50%" height={16} />
                  </div>
                  <Skeleton
                    variant="rounded"
                    width={56}
                    height={30}
                    className="shrink-0"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {!loading && !loadError && items && (
          <div className="flex flex-col gap-3">
            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-foreground"
                htmlFor="add-product-bin-search"
              >
                Search by title, variant, or SKU
              </label>
              <input
                id="add-product-bin-search"
                type="search"
                name="add-product-bin-search"
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-foreground shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-zinc-600 dark:bg-zinc-900"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
                autoFocus
                spellCheck={false}
              />
            </div>
            <div className="max-h-52 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-700">
              {filtered.length === 0 ? (
                <p className="p-3 text-sm text-zinc-500">No matches.</p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filtered.map((row) => {
                    const inQ = queueVariantIds.has(row.variant.id);
                    const onHand = Math.trunc(
                      Number(row.variant.inventory_quantity),
                    );
                    const onHandLabel = Number.isFinite(onHand) ? onHand : "—";
                    return (
                      <li
                        key={`${row.product.id}-${row.variant.id}`}
                        className="flex flex-col gap-1.5 p-2.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {row.product.title}
                          </p>
                          <p className="truncate text-xs text-zinc-500">
                            {row.variant.title || "Default"}{" "}
                            {row.sku ? (
                              <span className="font-mono">· {row.sku}</span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 text-[0.65rem] tabular-nums text-zinc-400">
                            Shopify on-hand: {onHandLabel}
                            {Number.isFinite(onHand) && onHand < 1
                              ? " (default qty 1)"
                              : null}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="small"
                          variant={inQ ? "outlined" : "contained"}
                          disabled={submitting}
                          onClick={() => addToQueue(row)}
                        >
                          {inQ ? "Add again" : "Add"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {queue.length > 0 ? (
              <div>
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  To add
                </p>
                <p className="mb-2 text-[0.7rem] text-zinc-500">
                  Qty is prefilled from each variant&apos;s Shopify on-hand when
                  you add it; you can change it here.
                </p>
                <ul className="space-y-2">
                  {queue.map((q) => (
                    <li
                      key={q.variantId}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50/90 px-2.5 py-2 dark:border-zinc-700 dark:bg-zinc-900/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {q.productTitle}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {q.variantTitle} ·{" "}
                          <span className="font-mono">{q.sku}</span>
                        </p>
                        <p className="mt-0.5 text-[0.65rem] text-zinc-400">
                          Shopify on-hand:{" "}
                          <span className="tabular-nums">{q.shopifyOnHand}</span>
                        </p>
                      </div>
                      <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300">
                        <span>Qty</span>
                        <input
                          type="number"
                          min={1}
                          className="w-20 rounded border border-zinc-200 bg-white px-1.5 py-1 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800"
                          value={q.quantity}
                          onChange={(e) =>
                            setQueuedQty(
                              q.variantId,
                              parseInt(e.target.value, 10) || 1,
                            )
                          }
                          disabled={submitting}
                        />
                      </label>
                      <button
                        type="button"
                        className="text-xs font-medium text-red-700 hover:underline dark:text-red-400"
                        disabled={submitting}
                        onClick={() => removeQueued(q.variantId)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button
          onClick={onClose}
          color="inherit"
          disabled={submitting}
          size="large"
        >
          Cancel
        </Button>
        <Button
          onClick={submit}
          color="primary"
          variant="contained"
          disabled={submitting || queue.length === 0 || !binCode}
          size="large"
        >
          {submitting ? "Saving…" : "Save to bin"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
