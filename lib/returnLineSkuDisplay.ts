import { deriveKokobayStyleSkuFromTitle } from "@/lib/deriveKokobayStyleSkuFromTitle";
import type { KokobayOrderLine } from "@/lib/kokobayOrderLines";
import { isVariantIdPlaceholderSku } from "@/lib/variantIdPlaceholderSku";

/**
 * Replaces legacy `V{variant_id}` display values with the Kokobay-style code
 * derived from the line title, or leaves real merchant SKUs unchanged.
 * Use on the warehouse return page and anywhere form submissions still hold an old V code.
 */
export function lineSkuForWarehouseUi(
  line: Pick<KokobayOrderLine, "sku" | "title">,
): string {
  const sku = String(line.sku ?? "").trim();
  if (!isVariantIdPlaceholderSku(sku)) {
    return sku;
  }
  const t = String(line.title ?? "").trim();
  return deriveKokobayStyleSkuFromTitle(t) ?? sku;
}
