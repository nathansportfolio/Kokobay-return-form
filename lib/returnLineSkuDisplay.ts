import { deriveKokobayStyleSkuFromTitle } from "@/lib/deriveKokobayStyleSkuFromTitle";
import type { KokobayOrderLine } from "@/lib/kokobayOrderLines";
import { formatKokobaySkuDisplay } from "@/lib/skuDisplay";
import { isVariantIdPlaceholderSku } from "@/lib/variantIdPlaceholderSku";

/**
 * Replaces legacy `V{variant_id}` display values with the Kokobay-style code
 * derived from the line title, or leaves real merchant SKUs unchanged.
 * Use for **display only**; keep {@link KokobayOrderLine} `sku` as the catalog
 * key (`displaySkuForShopifyLineItem`) everywhere else (forms, APIs, Mongo).
 */
export function lineSkuForWarehouseUi(
  line: Pick<KokobayOrderLine, "sku" | "title">,
): string {
  const sku = String(line.sku ?? "").trim();
  if (!isVariantIdPlaceholderSku(sku)) {
    return formatKokobaySkuDisplay(sku);
  }
  const t = String(line.title ?? "").trim();
  const core = deriveKokobayStyleSkuFromTitle(t) ?? sku;
  return formatKokobaySkuDisplay(core);
}
