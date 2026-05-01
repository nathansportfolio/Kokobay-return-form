/**
 * Editable overnight customer email: placeholders and formatting for copy/preview.
 */

export type OvernightEmailLineItem = {
  quantity: number;
  productTitle: string;
  size: string | null;
  /** Full line label for on-screen lists. */
  displayLine: string;
};

export const DEFAULT_OVERNIGHT_EMAIL_TEMPLATE = `Hi {{name}},

Our website had a issue in the early hours of the morning. Are you able to confirm the sizes before we send the shipment please.

{{items}}

Regards,

Kokobay Team`;

export const OVERNIGHT_EMAIL_TEMPLATE_STORAGE_KEY =
  "kokobay-overnight-email-template-v1";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain-text lines for {{items}} (size not bold in plain copy). */
export function formatOvernightItemsPlain(
  items: OvernightEmailLineItem[],
): string {
  return items
    .map((it) => {
      const q = it.quantity;
      const base = it.productTitle;
      if (it.size) {
        return `${q}× ${base} — size: ${it.size}`;
      }
      return `${q}× ${base}`;
    })
    .join("\n");
}

/** HTML fragment for lines (size in <strong>). */
export function formatOvernightItemsHtml(
  items: OvernightEmailLineItem[],
): string {
  return items
    .map((it) => {
      const q = it.quantity;
      const base = escapeHtml(it.productTitle);
      if (it.size) {
        return `${q}× ${base} — <strong>${escapeHtml(it.size)}</strong>`;
      }
      return `${q}× ${base}`;
    })
    .join("<br>\n");
}

export function applyOvernightTemplatePlain(
  template: string,
  name: string,
  itemsPlain: string,
): string {
  return template
    .replaceAll("{{name}}", name)
    .replaceAll("{{items}}", itemsPlain);
}

/**
 * HTML body for rich paste: name escaped; `itemsHtml` is trusted (generated here).
 * Newlines in the template become `<br>`.
 */
export function applyOvernightTemplateHtml(
  template: string,
  name: string,
  itemsHtml: string,
): string {
  const merged = template
    .replaceAll("{{name}}", escapeHtml(name))
    .replaceAll("{{items}}", itemsHtml);
  return merged.replace(/\r\n/g, "\n").replace(/\n/g, "<br>\n");
}
