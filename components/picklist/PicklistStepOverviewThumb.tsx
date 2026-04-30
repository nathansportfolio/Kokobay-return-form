"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { PickStep } from "@/lib/picklistShared";
import { womensFashionPlaceholderForStep } from "@/lib/picklistPlaceholderImages";

type Props = {
  step: PickStep;
  name: string;
};

/**
 * Thumbnail for a pick step on the list overview (same data as the walk, smaller tile).
 */
export function PicklistStepOverviewThumb({ step, name }: Props) {
  const primary = step.thumbnailImageUrl?.trim();
  const placeholder = womensFashionPlaceholderForStep(step);
  const [usePlaceholder, setUsePlaceholder] = useState(!primary);

  useEffect(() => {
    setUsePlaceholder(!primary);
  }, [primary, step.step, step.sku, step.location]);

  const src = !primary || usePlaceholder ? placeholder : primary;

  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 sm:h-[4.5rem] sm:w-[4.5rem] dark:border-zinc-600 dark:bg-zinc-800/80">
      <Image
        src={src}
        alt={name}
        fill
        className="object-cover"
        sizes="(max-width: 640px) 4rem, 4.5rem"
        onError={() => {
          if (primary) setUsePlaceholder(true);
        }}
      />
    </div>
  );
}
