"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { AssemblyLine } from "@/lib/fetchTodaysPickLists";
import { womensFashionPlaceholderForAssemblyLine } from "@/lib/picklistPlaceholderImages";

type Props = {
  orderNumber: string;
  line: AssemblyLine;
};

/**
 * Thumbnail for an assembly line (product image or placeholder).
 */
export function AssemblyLineThumb({ orderNumber, line }: Props) {
  const primary = line.thumbnailImageUrl?.trim();
  const placeholder = womensFashionPlaceholderForAssemblyLine({
    orderNumber,
    lineIndex: line.lineIndex,
    sku: line.sku,
  });
  const [usePlaceholder, setUsePlaceholder] = useState(!primary);
  useEffect(() => {
    setUsePlaceholder(!primary);
  }, [primary, line.lineIndex, line.sku]);

  const src = !primary || usePlaceholder ? placeholder : primary;

  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/80">
      <Image
        src={src}
        alt={line.name}
        fill
        className="object-cover"
        sizes="3.5rem"
        onError={() => {
          if (primary) setUsePlaceholder(true);
        }}
      />
    </div>
  );
}
