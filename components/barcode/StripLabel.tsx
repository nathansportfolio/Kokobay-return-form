"use client";

import { useEffect, useId, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { ArrowUp } from "@phosphor-icons/react";

type Props = {
  /**
   * **Warehouse:** bold on the left (e.g. bin `A-01-F`).
   * **Product:** small line below the barcode (SKU only).
   */
  humanText: string;
  /** Value encoded in CODE128 (must be printable ASCII). */
  barcodeData: string;
  className?: string;
  /**
   * - `warehouse` (default): bold text, up arrow, barcode (bin / racking labels).
   * - `product`: barcode with SKU in small text underneath.
   */
  variant?: "warehouse" | "product";
  /** `variant === "product"`: e.g. Size and Colour from Shopify (shown under SKU). */
  productVariantOptions?: { name: string; value: string }[];
};

/**
 * - Warehouse: [ bold text | ↑ | CODE128 ] — match physical racking labels.
 * - Product: CODE128, then small SKU line (distinct from racking look).
 */
export function StripLabel({
  humanText,
  barcodeData,
  className = "",
  variant = "warehouse",
  productVariantOptions,
}: Props) {
  const id = useId();
  const safeId = `br-${id.replace(/:/g, "")}`;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [encodeError, setEncodeError] = useState(false);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    setEncodeError(false);
    if (!barcodeData.trim()) {
      el.innerHTML = "";
      return;
    }
    try {
      el.innerHTML = "";
      const isProduct = variant === "product";
      // Product labels: keep ~¼ of the previous on-screen size; warehouse unchanged.
      JsBarcode(el, barcodeData, {
        format: "CODE128",
        displayValue: false,
        width: isProduct ? 0.28 : 0.9,
        height: isProduct ? 8 : 20,
        margin: 0,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {
      setEncodeError(true);
      el.innerHTML = "";
    }
  }, [barcodeData, variant]);

  const hasData = Boolean(barcodeData.trim());

  const baseWrap =
    "label-print w-full max-w-[20rem] overflow-hidden rounded-md border-2 border-zinc-900/90 bg-white shadow-sm print:max-w-none print:border-2 print:shadow-none";

  if (variant === "product") {
    return (
      <div
        className={`${baseWrap} flex !max-w-[6.5rem] flex-col items-stretch sm:!max-w-[8.5rem] print:!max-w-[8.5rem] ${className}`.trim()}
      >
        <div className="relative flex w-full flex-col items-center justify-center gap-0.5 px-1 py-1.5 sm:px-1.5 sm:py-2">
          {hasData ? (
            <>
              <svg
                ref={svgRef}
                id={safeId}
                className="box-content block h-auto w-full max-h-[12px] max-w-full"
                role="img"
                aria-label={`Barcode for ${barcodeData}`}
              />
              {encodeError ? (
                <div className="absolute left-1/2 top-2 w-[90%] max-w-xs -translate-x-1/2 text-center text-[0.55rem] text-red-700 print:text-xs">
                  Bad chars
                </div>
              ) : null}
              <span className="sr-only">{barcodeData}</span>
            </>
          ) : (
            <span className="text-[0.55rem] text-zinc-500 print:text-xs">—</span>
          )}
          <span className="max-w-full break-all text-center text-[0.4rem] font-mono font-normal leading-tight text-zinc-800 tabular-nums print:text-[0.4rem]">
            {humanText}
          </span>
          {productVariantOptions && productVariantOptions.length > 0 ? (
            <div className="w-full text-center text-[0.3rem] leading-tight text-zinc-500 print:text-[0.3rem]">
              {productVariantOptions.map((o) => (
                <p
                  key={`${o.name}-${o.value}`}
                  className="m-0 line-clamp-2"
                >
                  <span className="font-sans text-zinc-500">{o.name}:</span>{" "}
                  <span className="font-sans text-zinc-600">{o.value}</span>
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${baseWrap} flex items-stretch ${className}`.trim()}
    >
      <div className="flex min-w-0 flex-1 items-center justify-center self-stretch px-1.5 py-2 pr-0 sm:px-2.5 sm:py-2.5 sm:pr-0">
        <span className="truncate text-sm font-bold tabular-nums text-zinc-900 sm:text-base print:text-sm">
          {humanText}
        </span>
      </div>
      <div
        className="flex w-5 shrink-0 items-center justify-center self-stretch border-x border-zinc-200/90 bg-zinc-50/80 sm:w-6 print:w-5"
        aria-hidden
      >
        <ArrowUp className="h-4 w-4 text-zinc-900" weight="fill" />
      </div>
      <div className="relative flex min-w-0 w-[40%] max-w-[4.75rem] shrink-0 items-center justify-center self-stretch px-1.5 py-2 sm:w-[38%] sm:max-w-[5rem] sm:px-2 sm:py-2.5">
        {hasData ? (
          <>
            <svg
              ref={svgRef}
              id={safeId}
              className="box-content block h-auto w-auto max-h-[22px] max-w-full"
              role="img"
              aria-label={`Barcode for ${barcodeData}`}
            />
            {encodeError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/95 p-0.5 text-center text-[0.55rem] text-red-700 print:text-xs">
                Bad chars
              </div>
            ) : null}
            <span className="sr-only">{barcodeData}</span>
          </>
        ) : (
          <span className="self-center text-[0.55rem] text-zinc-500 print:text-xs">
            —
          </span>
        )}
      </div>
    </div>
  );
}
