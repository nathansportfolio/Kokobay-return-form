"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

export type ReturnPageLoadToastHint =
  | "shopify_not_found"
  | "shopify_unavailable"
  | "sample_catalog"
  | null;

/**
 * One-shot toasts when `/returns/[order]` has no line items (server already shows copy).
 */
export function ReturnPageStatusToast({
  hint,
}: {
  hint: ReturnPageLoadToastHint;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (!hint || fired.current) return;
    fired.current = true;

    if (hint === "shopify_not_found") {
      toast.error("Order not found in Shopify", {
        description:
          "Try the confirmation name (e.g. #57063), the order number, or the long Admin id, then search again from Returns.",
      });
      return;
    }
    if (hint === "shopify_unavailable") {
      toast.error("Could not load this order from Shopify", {
        description:
          "Check SHOPIFY_* credentials and try again, or use order search from Returns.",
      });
      return;
    }
    if (hint === "sample_catalog") {
      toast.info("Sample catalog only", {
        description:
          "SHOPIFY_STORE is not set, so line items are not live Shopify data. Configure Shopify for real orders.",
      });
    }
  }, [hint]);

  return null;
}
