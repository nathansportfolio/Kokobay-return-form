"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { StripLabel } from "@/components/barcode/StripLabel";
import type { BinsLayoutRack } from "@/lib/getBinsLayoutTree";
import {
  compareKokobayLocation,
  parseKokobayLocation,
} from "@/lib/kokobayLocationFormat";
import { compareRackCode } from "@/lib/warehouseRackLayout";
import {
  catalogEntriesToProductRows,
  type ProductCatalogEntry,
  type ProductCatalogLabelRow,
} from "@/lib/shopifyProductCatalog";

const BIN_CODE_RE = /^[A-Z]+-\d{1,2}-[A-F]$/i;

function normalizeBinCode(s: string): string {
  const t = s.trim();
  if (!t) return "";
  const p = parseKokobayLocation(t);
  if (p) {
    return `${p.aisle}-${String(p.bay).padStart(2, "0")}-${p.shelfLetter}`;
  }
  return t.toUpperCase();
}

function isValidBinCode(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (parseKokobayLocation(t)) return true;
  return BIN_CODE_RE.test(t);
}

function collectAllBinCodes(racks: BinsLayoutRack[]): string[] {
  const out: string[] = [];
  for (const r of racks) {
    for (const b of r.bays) {
      for (const lv of b.levels) {
        if (lv.code) {
          out.push(lv.code.trim().toUpperCase());
        }
      }
    }
  }
  return [...new Set(out)].sort(compareKokobayLocation);
}

function collectCodesForRack(rack: BinsLayoutRack): string[] {
  return collectAllBinCodes([rack]);
}

function parseListFromText(raw: string): string[] {
  return raw
    .split(/[\n,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

type BinsGetResponse = {
  ok: boolean;
  racks?: BinsLayoutRack[];
  error?: string;
};

type SheetItem =
  | { kind: "bin"; key: string; code: string }
  | {
      kind: "product";
      key: string;
      sku: string;
      productTitle: string;
      productId: number;
      variantOptions: { name: string; value: string }[];
    };

type SheetRenderEntry =
  | { type: "bin"; item: Extract<SheetItem, { kind: "bin" }> }
  | { type: "groupHeader"; key: string; productId: number; productTitle: string }
  | { type: "product"; item: Extract<SheetItem, { kind: "product" }> };

/** Bins (bin order) then all product variants, grouped and sorted by Shopify product id. */
function mergeBySku(a: ProductCatalogLabelRow[]): ProductCatalogLabelRow[] {
  const m = new Map<string, ProductCatalogLabelRow>();
  for (const r of a) {
    if (!m.has(r.sku)) m.set(r.sku, r);
  }
  return [...m.values()];
}

function sortLabelRowsByProduct(
  rows: ProductCatalogLabelRow[],
): ProductCatalogLabelRow[] {
  return [...rows].sort((a, b) => {
    if (a.productId !== b.productId) {
      return a.productId - b.productId;
    }
    return a.sku.localeCompare(b.sku, undefined, { numeric: true, sensitivity: "base" });
  });
}

/**
 * Bins first, then products. Insert a small header when the Shopify product id
 * changes so variants of the same parent list together in the grid.
 */
function toSheetRenderEntries(sheet: SheetItem[]): SheetRenderEntry[] {
  const out: SheetRenderEntry[] = [];
  let prevProductId: number | undefined;
  for (const s of sheet) {
    if (s.kind === "bin") {
      out.push({ type: "bin", item: s });
      continue;
    }
    if (s.productId !== prevProductId) {
      out.push({
        type: "groupHeader",
        key: `hdr-${String(s.productId)}`,
        productId: s.productId,
        productTitle: s.productTitle,
      });
      prevProductId = s.productId;
    }
    out.push({ type: "product", item: s });
  }
  return out;
}

export function BarcodesClient() {
  const searchParams = useSearchParams();
  const [binCodes, setBinCodes] = useState<string[]>([]);
  const [productSkus, setProductSkus] = useState<ProductCatalogLabelRow[]>([]);
  const [customBinInput, setCustomBinInput] = useState("");
  const [racks, setRacks] = useState<BinsLayoutRack[] | null>(null);
  const [racksError, setRacksError] = useState<string | null>(null);
  const [selectedRack, setSelectedRack] = useState("");
  const [simpleOnly, setSimpleOnly] = useState(true);
  const [loadTick, setLoadTick] = useState(0);
  const [catalogMeta, setCatalogMeta] = useState<{
    count: number;
    lastSync: string | null;
    lastSyncDay: string | null;
  } | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogSyncing, setCatalogSyncing] = useState(false);
  const [productSearchQ, setProductSearchQ] = useState("");
  const [productSearchQDebounced, setProductSearchQDebounced] = useState("");
  const [searchResults, setSearchResults] = useState<
    ProductCatalogLabelRow[] | null
  >(null);
  const [searchPending, setSearchPending] = useState(false);
  const [addAllPending, setAddAllPending] = useState(false);
  const [printSheetDialogOpen, setPrintSheetDialogOpen] = useState(false);
  const didApplyUrl = useRef(false);
  const documentTitleForPrint = useRef<string | null>(null);

  const productRowsSorted = useMemo(
    () => sortLabelRowsByProduct(productSkus),
    [productSkus],
  );

  const sheetItems: SheetItem[] = useMemo(() => {
    const bins: SheetItem[] = binCodes.map((code) => ({
      kind: "bin",
      key: `b-${code}`,
      code,
    }));
    const prods: SheetItem[] = productRowsSorted.map((r) => ({
      kind: "product",
      key: `p-${r.sku}`,
      sku: r.sku,
      productTitle: r.productTitle,
      productId: r.productId,
      variantOptions: r.variantOptions,
    }));
    return [...bins, ...prods];
  }, [binCodes, productRowsSorted]);

  const sheetRenderEntries = useMemo(
    () => toSheetRenderEntries(sheetItems),
    [sheetItems],
  );

  useEffect(() => {
    void (async () => {
      setRacksError(null);
      try {
        const res = await fetch("/api/bins", { cache: "no-store" });
        const data = (await res.json()) as BinsGetResponse;
        if (!res.ok || !data.ok) {
          setRacksError(data.error ?? "Failed to load bins");
          setRacks([]);
          return;
        }
        setRacks(data.racks ?? []);
        const p = (searchParams.get("rack") ?? "").trim();
        if (p) {
          setSelectedRack(p);
        }
      } catch (e) {
        setRacksError(e instanceof Error ? e.message : "Load failed");
        setRacks([]);
      }
    })();
  }, [loadTick]);

  useEffect(() => {
    const p = (searchParams.get("rack") ?? "").trim();
    if (p) {
      setSelectedRack(p);
    }
  }, [searchParams]);

  useEffect(() => {
    const t = window.setTimeout(
      () => setProductSearchQDebounced(productSearchQ.trim()),
      320,
    );
    return () => window.clearTimeout(t);
  }, [productSearchQ]);

  useEffect(() => {
    void (async () => {
      setCatalogError(null);
      try {
        const res = await fetch(
          `/api/warehouse/product-catalog?meta=1&_bust=${Date.now()}`,
          { cache: "no-store", credentials: "same-origin" },
        );
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setCatalogError(j.error ?? "Failed to load product catalog");
          setCatalogMeta(null);
          return;
        }
        const d = (await res.json()) as {
          ok?: boolean;
          count: unknown;
          lastSync: string | null;
          lastSyncDay: string | null;
        };
        if (typeof d.count !== "number") {
          setCatalogError("Unexpected catalog response");
          setCatalogMeta(null);
          return;
        }
        setCatalogMeta({
          count: d.count,
          lastSync: d.lastSync,
          lastSyncDay: d.lastSyncDay,
        });
      } catch (e) {
        setCatalogError(e instanceof Error ? e.message : "Load failed");
        setCatalogMeta(null);
      }
    })();
  }, [loadTick]);

  useEffect(() => {
    if (!productSearchQDebounced) {
      setSearchResults(null);
      setSearchPending(false);
      return;
    }
    setSearchPending(true);
    const q = encodeURIComponent(productSearchQDebounced);
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch(
          `/api/warehouse/product-catalog?q=${q}&limit=50`,
          { signal: ac.signal, cache: "no-store" },
        );
        if (!res.ok) {
          setSearchResults(null);
          return;
        }
        const data = (await res.json()) as { items?: ProductCatalogEntry[] };
        if (!data.items || !Array.isArray(data.items)) {
          setSearchResults(null);
          return;
        }
        setSearchResults(catalogEntriesToProductRows(data.items, false));
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          return;
        }
        setSearchResults(null);
      } finally {
        if (!ac.signal.aborted) {
          setSearchPending(false);
        }
      }
    })();
    return () => {
      ac.abort();
    };
  }, [productSearchQDebounced]);

  /** One-time: ?rack=&codes=&skus= (resolves skus from Mongo product catalog) */
  useEffect(() => {
    if (didApplyUrl.current) {
      return;
    }
    if (racks === null || racksError) {
      return;
    }
    const needSkus = (searchParams.get("skus") ?? "").trim();
    (async () => {
      const addBins: string[] = [];
      const rackP = (searchParams.get("rack") ?? "").trim();
      if (rackP) {
        const tree = racks.find(
          (r) => r.rack.toUpperCase() === rackP.toUpperCase(),
        );
        if (tree) {
          addBins.push(...collectCodesForRack(tree));
        }
      }
      const codesP = searchParams.get("codes");
      if (codesP) {
        const ok = parseListFromText(codesP)
          .map(normalizeBinCode)
          .filter(isValidBinCode);
        addBins.push(...ok);
      }
      if (addBins.length) {
        setBinCodes((p) => [...new Set([...p, ...addBins])]);
      }

      if (needSkus) {
        try {
          const res = await fetch(
            `/api/warehouse/product-catalog?skus=${encodeURIComponent(needSkus)}`,
            { cache: "no-store" },
          );
          if (res.ok) {
            const data = (await res.json()) as {
              ok?: boolean;
              items: ProductCatalogEntry[];
            };
            if (data.items?.length) {
              setProductSkus((p) =>
                mergeBySku([...p, ...catalogEntriesToProductRows(data.items, false)]),
              );
            }
          }
        } catch {
          /* no-op: optional URL prefill */
        }
      }
      didApplyUrl.current = true;
    })();
  }, [racks, searchParams, racksError]);

  const sortedRackIds = useMemo(
    () => (racks ?? []).map((r) => r.rack).sort(compareRackCode),
    [racks],
  );

  const addBinsFromRack = useCallback(() => {
    if (!racks || !selectedRack) return;
    const tree = racks.find(
      (r) => r.rack.toUpperCase() === selectedRack.toUpperCase(),
    );
    if (!tree) return;
    setBinCodes((p) => [
      ...new Set([...p, ...collectCodesForRack(tree)]),
    ]);
  }, [racks, selectedRack]);

  const addAllBins = useCallback(() => {
    if (!racks?.length) return;
    setBinCodes((p) => [...new Set([...p, ...collectAllBinCodes(racks)])]);
  }, [racks]);

  const addCustomBins = useCallback(() => {
    const add = parseListFromText(customBinInput)
      .map(normalizeBinCode)
      .filter(isValidBinCode);
    const bad = parseListFromText(customBinInput).filter(
      (c) => !isValidBinCode(c) && c.trim() !== "",
    );
    if (bad.length) {
      globalThis.alert(
        `Skipped invalid (use e.g. A-01-F): ${bad
          .slice(0, 3)
          .join(", ")}${bad.length > 3 ? "…" : ""}`,
      );
    }
    if (add.length) {
      setBinCodes((p) => [...new Set([...p, ...add])]);
      setCustomBinInput("");
    }
  }, [customBinInput]);

  const addCatalogToSheet = useCallback(
    async (simpleFilter: boolean) => {
      if (addAllPending) {
        return;
      }
      setAddAllPending(true);
      try {
        const res = await fetch(
          "/api/warehouse/product-catalog?all=1&cap=10000",
          { cache: "no-store" },
        );
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error(
            j.error ?? "Could not load the full catalog from the server",
          );
          return;
        }
        const data = (await res.json()) as { items: ProductCatalogEntry[] };
        const rows = catalogEntriesToProductRows(data.items, simpleFilter);
        if (!rows.length) {
          toast.error(
            catalogMeta?.count === 0
              ? "The catalog is empty. Sync from Shopify first."
              : simpleFilter
                ? "No simple products to add. Try “Add all variants” or uncheck the filter, or sync again."
                : "No product rows in the catalog. Sync from Shopify first.",
          );
          return;
        }
        setProductSkus((p) => mergeBySku([...p, ...rows]));
        toast.success(
          `Added ${String(rows.length)} product label(s) to the sheet`,
        );
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Failed to add products to the sheet",
        );
      } finally {
        setAddAllPending(false);
      }
    },
    [addAllPending, catalogMeta?.count],
  );

  const syncFromShopify = useCallback(async () => {
    if (catalogSyncing) {
      return;
    }
    setCatalogSyncing(true);
    try {
      const res = await fetch("/api/warehouse/product-catalog", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      });
      const raw = await res.text();
      let data: {
        ok?: boolean;
        count?: number;
        withSku?: number;
        lastSync?: string;
        lastSyncDay?: string | null;
        error?: string;
      } = {};
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        toast.error(
          res.ok
            ? "Invalid response from server. Check the terminal for API errors."
            : `Sync failed (HTTP ${String(res.status)}). Are you still logged in?`,
        );
        return;
      }
      if (!res.ok || !data.ok) {
        toast.error(
          data.error
            ? String(data.error)
            : "Sync failed. Set SHOPIFY_STORE, SHOPIFY_CLIENT_ID, and SHOPIFY_CLIENT_SECRET in the server environment (see .env.example).",
        );
        return;
      }
      setCatalogMeta({
        count: typeof data.count === "number" ? data.count : 0,
        lastSync: data.lastSync ?? null,
        lastSyncDay: data.lastSyncDay ?? null,
      });
      setLoadTick((t) => t + 1);
      const w = data.withSku ?? 0;
      if (w === 0) {
        toast.warning(
          "No active variants were written. In Shopify, products must be Active, and the Admin API must return your catalog.",
          { duration: 8_000 },
        );
        return;
      }
      toast.success(
        `Sync complete. ${String(w)} variant(s) written (${String(
          data.count ?? 0,
        )} rows in the catalog). Variants without a Shopify barcode use the key KOKO-VAR-{id}.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setCatalogSyncing(false);
    }
  }, [catalogSyncing]);

  const openPrintSheetDialog = useCallback(() => {
    if (sheetItems.length === 0) {
      toast.error("Add bin or product labels to the sheet first.");
      return;
    }
    setPrintSheetDialogOpen(true);
  }, [sheetItems.length]);

  useEffect(() => {
    const restoreTitle = () => {
      if (documentTitleForPrint.current != null) {
        document.title = documentTitleForPrint.current;
        documentTitleForPrint.current = null;
      }
    };
    globalThis.addEventListener("afterprint", restoreTitle);
    return () => globalThis.removeEventListener("afterprint", restoreTitle);
  }, []);

  const runPrintSheet = useCallback(() => {
    setPrintSheetDialogOpen(false);
    documentTitleForPrint.current = document.title;
    document.title = "\u00A0";
    window.setTimeout(() => {
      globalThis.print();
    }, 200);
  }, []);

  return (
    <div className="print-root mx-auto w-full max-w-4xl flex-1 p-4 pb-16 sm:p-6 print:max-w-none print:p-0">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Barcode labels
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setBinCodes([]);
              setProductSkus([]);
            }}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/80"
            title="Remove all labels from the current sheet (does not change Mongo or Shopify)"
          >
            Clear sheet
          </button>
          <button
            type="button"
            onClick={() => setLoadTick((t) => t + 1)}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/80"
            title="Fetch latest bins and products from the server"
          >
            Reload data
          </button>
        </div>
      </div>

      <div className="print:hidden mt-8 space-y-10">
        <section>
          <h2 className="text-lg font-semibold text-foreground">Bin location labels</h2>
          {racksError ? (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {racksError}
            </p>
          ) : null}
          <div className="mt-3 flex flex-col gap-2">
            <span className="text-xs text-zinc-500">Rack (fill sheet with that rack)</span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="min-w-[6rem] rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                value={selectedRack}
                onChange={(e) => setSelectedRack(e.target.value)}
              >
                <option value="">Choose rack…</option>
                {sortedRackIds.map((id) => (
                  <option key={id} value={id}>
                    Rack {id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
                onClick={addBinsFromRack}
                disabled={!selectedRack}
              >
                Add rack to sheet
              </button>
              <button
                type="button"
                className="text-sm text-zinc-600 underline dark:text-zinc-400"
                onClick={addAllBins}
                disabled={!racks?.length}
              >
                Add all bin codes
              </button>
            </div>
          </div>
          <div className="mt-3">
            <label
              className="text-xs text-zinc-500"
              htmlFor="custom-bins"
            >
              Paste bin codes (comma, semicolon, or one per line)
            </label>
            <textarea
              id="custom-bins"
              className="mt-0.5 w-full min-h-[4.5rem] rounded-md border border-zinc-200 bg-white px-2.5 py-2 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-900"
              value={customBinInput}
              onChange={(e) => setCustomBinInput(e.target.value)}
              placeholder="A-01-F, A-01-D"
            />
            <button
              type="button"
              onClick={addCustomBins}
              className="mt-1.5 text-sm font-medium text-emerald-800 underline dark:text-emerald-200"
            >
              Add to sheet
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Product labels (text + barcode = SKU)
          </h2>
          {catalogError ? (
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200/90">
              {catalogError} — is MongoDB configured, or try again after a{" "}
              <strong>Sync from Shopify</strong>?
            </p>
          ) : null}
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {catalogMeta
              ? `${String(catalogMeta.count)} variant(s) in catalog${
                  catalogMeta.lastSync
                    ? ` · last full sync ${new Date(catalogMeta.lastSync).toLocaleString()}`
                    : ""
                }${
                  catalogMeta.lastSyncDay
                    ? ` · feed day (London) ${catalogMeta.lastSyncDay}`
                    : ""
                }`
              : "Loading catalog…"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void syncFromShopify();
              }}
              disabled={catalogSyncing}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm hover:border-zinc-400 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {catalogSyncing ? "Syncing from Shopify…" : "Sync from Shopify"}
            </button>
            <span className="text-xs text-zinc-500">
              One row per <strong>variant</strong> (every active product). The stored key is
              the Shopify barcode when set; if a variant has no barcode, the key is{" "}
              <code className="text-[0.7rem]">KOKO-VAR-{"{id}"}</code> so nothing is
              left out.
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex max-w-prose items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={simpleOnly}
                  onChange={(e) => setSimpleOnly(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                “Add from catalog” adds only <strong>single-variant</strong> (simple) products
                on Shopify
              </label>
              <button
                type="button"
                onClick={() => {
                  void addCatalogToSheet(simpleOnly);
                }}
                disabled={addAllPending}
                className="rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-950 dark:border-violet-800/60 dark:bg-violet-950/30 dark:text-violet-100"
              >
                {addAllPending ? "Loading catalog…" : "Add from catalog"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void addCatalogToSheet(false);
                }}
                disabled={addAllPending}
                className="rounded-md border border-violet-500/50 bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60 dark:bg-violet-500 dark:hover:bg-violet-400"
              >
                {addAllPending
                  ? "Loading catalog…"
                  : "Add all variants to sheet (full catalog)"}
              </button>
              <span className="text-xs text-zinc-500">
                One label per active variant; grouped by product on the sheet below.
              </span>
            </div>
          </div>
          <div className="mt-4 max-w-lg">
            <label
              className="text-xs text-zinc-500"
              htmlFor="barcode-prod-search"
            >
              Search by product title or SKU
            </label>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <input
                id="barcode-prod-search"
                className="min-w-[12rem] flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                value={productSearchQ}
                onChange={(e) => setProductSearchQ(e.target.value)}
                placeholder="e.g. Hoodie, BRK-12"
                autoComplete="off"
                spellCheck="false"
              />
              {searchPending ? (
                <span className="text-xs text-zinc-500">Searching…</span>
              ) : null}
            </div>
            {searchResults && searchResults.length > 0 ? (
              <ul className="mt-2 max-h-56 overflow-auto rounded-md border border-zinc-200 bg-zinc-50/80 p-2 text-sm dark:border-zinc-600 dark:bg-zinc-800/30">
                <li className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/80 pb-2 text-xs text-zinc-500 dark:border-zinc-600">
                  <span>{searchResults.length} result(s)</span>
                  <button
                    type="button"
                    className="text-violet-800 underline dark:text-violet-200"
                    onClick={() => {
                      setProductSkus((p) => mergeBySku([...p, ...searchResults]));
                      toast.success(
                        `Added ${String(searchResults.length)} label(s) to the sheet`,
                      );
                    }}
                  >
                    Add all results
                  </button>
                </li>
                {searchResults.map((r) => (
                  <li
                    key={r.sku}
                    className="mt-1 flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200/50 py-1.5 last:border-0 dark:border-zinc-600/50"
                  >
                    <div className="min-w-0">
                      <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200">
                        {r.sku}
                      </span>
                      <p className="m-0 text-zinc-600 line-clamp-2 dark:text-zinc-300">
                        {r.productTitle}
                        {r.isSimple
                          ? ""
                          : " (multi variant)"}
                      </p>
                      {r.variantOptions.length > 0 ? (
                        <p className="m-0 mt-1 text-xs leading-snug text-zinc-800 dark:text-zinc-200">
                          {r.variantOptions.map((o, oi) => (
                            <span
                              key={`${r.sku}-opt-${String(oi)}-${o.name}`}
                            >
                              {oi > 0 ? (
                                <span className="text-zinc-300 dark:text-zinc-500">
                                  {" "}
                                  ·{" "}
                                </span>
                              ) : null}
                              <span className="text-zinc-500 dark:text-zinc-400">
                                {o.name}:
                              </span>{" "}
                              <span className="font-medium">{o.value}</span>
                            </span>
                          ))}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProductSkus((p) => mergeBySku([...p, r]));
                        toast.success(`Added ${r.sku} to the sheet`);
                      }}
                      className="shrink-0 rounded border border-violet-200/80 bg-white px-2 py-0.5 text-xs font-medium text-violet-900 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-100"
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {searchResults && !searchResults.length && productSearchQDebounced ? (
              <p className="mt-1 text-sm text-zinc-500">No products match that search</p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="mt-10 print:mt-0">
        <div className="print:hidden mb-3">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
            <div className="min-w-0">
              <h2 className="text-sm font-medium text-zinc-500">Sheet preview</h2>
              {sheetItems.length > 0 ? (
                <p className="mt-1 text-xs tabular-nums text-zinc-500">
                  {sheetItems.length} label{sheetItems.length === 1 ? "" : "s"}{" "}
                  on this sheet
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={openPrintSheetDialog}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-900/30 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:border-zinc-100/20 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Print full sheet
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Bins first, then products. The grid below matches the printed page
            — print on A4 / Letter, then cut along the gaps.
          </p>
        </div>
        {sheetItems.length === 0 ? (
          <p className="print:hidden text-sm text-zinc-500">
            Add bin codes or product rows above, then use Print full sheet.
          </p>
        ) : null}

        {sheetItems.length > 0 ? (
          <div className="label-cut-paper mx-auto max-w-[210mm] rounded-lg border border-dashed border-zinc-300 bg-zinc-100/30 p-3 sm:p-4 print:mx-0 print:max-w-none print:border-0 print:bg-white print:p-0">
            <ul
              className="label-cut-grid grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 print:grid-cols-2 print:gap-4"
              aria-label="Tiled label sheet"
            >
              {sheetRenderEntries.map((entry, i) => {
                if (entry.type === "groupHeader") {
                  return (
                    <li
                      key={entry.key}
                      className={`list-none col-span-full ${
                        i > 0
                          ? "mt-2 border-t border-dashed border-zinc-200 pt-2 dark:border-zinc-600"
                          : "pt-0.5"
                      } print:break-inside-avoid`}
                    >
                      <span className="line-clamp-2 text-[0.7rem] font-medium uppercase leading-tight tracking-wide text-zinc-500 dark:text-zinc-400">
                        {entry.productTitle}
                      </span>
                    </li>
                  );
                }
                if (entry.type === "bin") {
                  const { item } = entry;
                  return (
                    <li
                      key={item.key}
                      className="min-w-0 break-inside-avoid print:break-inside-avoid"
                    >
                      <StripLabel
                        className="!max-w-none w-full min-w-0"
                        variant="warehouse"
                        humanText={item.code}
                        barcodeData={item.code}
                      />
                    </li>
                  );
                }
                const { item } = entry;
                return (
                  <li
                    key={item.key}
                    className="flex min-w-0 justify-center break-inside-avoid print:break-inside-avoid"
                  >
                    <StripLabel
                      className="w-auto min-w-0 shrink-0"
                      variant="product"
                      humanText={item.sku}
                      barcodeData={item.sku}
                      productVariantOptions={item.variantOptions}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

      <Dialog
        open={printSheetDialogOpen}
        onClose={() => setPrintSheetDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="print-sheet-title"
      >
        <DialogTitle id="print-sheet-title">Print label sheet</DialogTitle>
        <DialogContent>
          <p className="m-0 text-sm text-zinc-600 dark:text-zinc-300">
            This opens your browser’s <strong>print</strong> dialog. You’ll get{" "}
            <strong>
              {sheetItems.length} label{sheetItems.length === 1 ? "" : "s"}{" "}
            </strong>
            tiled in a <strong>grid</strong> for cutting.
          </p>
          <p className="mb-0 mt-3 text-sm text-zinc-800 dark:text-zinc-200">
            <strong>Clean print (labels only):</strong> in the print dialog, open
            <strong> More options</strong> and turn <strong>off</strong>{" "}
            <em>Headers and footers</em> (or uncheck “Header and footer”) — that
            removes the date, site title, URL, and page numbers the browser
            would otherwise add. Pick <strong>A4</strong> or <strong>Letter</strong>{" "}
            if asked.
          </p>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            color="inherit"
            onClick={() => setPrintSheetDialogOpen(false)}
            size="large"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={runPrintSheet}
            size="large"
            autoFocus
          >
            Open print…
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
