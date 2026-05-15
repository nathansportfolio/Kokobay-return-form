import type { KokobayOrderLine } from "@/lib/kokobayOrderLines";
import { resolveOrderRefFromPathSegment } from "@/lib/orderRefAliases";
import { mapCustomerFormReasonToWarehouse } from "@/lib/customerFormToWarehouseReturn";
import { getLatestCustomerReturnFormForOrder } from "@/lib/customerReturnFormSubmission";
import { getLatestReturnLogForOrder } from "@/lib/returnLog";
import {
  normalizeReturnLineDisposition,
  type ReturnPageResume,
} from "@/lib/returnLogTypes";
import {
  getReturnOrderLinesFromProducts,
  getThumbnailsBySkus,
  getUnitPricesBySkus,
} from "@/lib/returnOrderLinesFromProducts";
import type { ShopifyOrderDisplay } from "@/lib/shopifyReturnOrderLookup";
import {
  buildKokobayOrderLinesFromShopifyOrder,
  enrichKokobayOrderLinesWithShopify,
  fetchReturnOrderFromShopify,
  fetchShopifyOrderDisplay,
  findShopifyOrderByQuery,
  shopifyOrderDisplayFromLookup,
  toShopifyOrderDisplay,
} from "@/lib/shopifyReturnOrderLookup";

export type { ReturnPageResume };

/** UI hints for the order return page (which data source we used, if any). */
export type ReturnPageFormContext =
  | { kind: "returnLog" }
  | {
      kind: "customerForm";
      submissionUid: string;
      datePosted: string;
      customerName: string;
      customerEmail: string;
      submittedAtIso: string;
    }
  | { kind: "noFormOnFile" };

/**
 * How bare order lines (no return log, no customer form) were loaded — Shopify
 * Admin vs dev sample from Mongo, or a failure to resolve in Shopify.
 */
export type ReturnPageBareLineSource =
  | null
  | { type: "shopify"; orderRef: string; shopifyOrderId: string }
  | { type: "sample" }
  | { type: "shopify_not_found" }
  | { type: "shopify_unavailable" };

/**
 * Loads order lines for the warehouse return flow: latest warehouse return log
 * (if any), else latest customer return form, else **Shopify order** (when
 * configured), else a dev sample of products.
 *
 * `shopifyOrder` is from the Admin API (order name, id, email, etc.) when the
 * store is configured; use it for headings and admin links, not the URL alone.
 */
export async function getReturnPageLinesAndResume(
  orderRef: string,
): Promise<{
  lines: KokobayOrderLine[];
  resume: ReturnPageResume | null;
  formContext: ReturnPageFormContext;
  bareLineSource: ReturnPageBareLineSource;
  shopifyOrder: ShopifyOrderDisplay | null;
}> {
  const key = resolveOrderRefFromPathSegment(orderRef);
  if (!key) {
    return {
      lines: [],
      resume: null,
      formContext: { kind: "noFormOnFile" },
      bareLineSource: null,
      shopifyOrder: null,
    };
  }

  const last = await getLatestReturnLogForOrder(key);
  if (last?.lines.length) {
    const logLineById = new Map(last.lines.map((l) => [l.lineId, l]));

    if (process.env.SHOPIFY_STORE?.trim()) {
      const order = await findShopifyOrderByQuery(key);
      if (order) {
        const shopifyLines = await buildKokobayOrderLinesFromShopifyOrder(order);
        if (shopifyLines.length > 0) {
          const shopifyIds = new Set(shopifyLines.map((l) => l.id));
          const logIdsMatched = last.lines.filter((l) => shopifyIds.has(l.lineId))
            .length;
          if (
            logIdsMatched !== last.lines.length ||
            shopifyLines.length !== last.lines.length
          ) {
            console.warn(
              "[getReturnPageLinesAndResume] return log lines differ from Shopify order; using live Shopify lines",
              {
                orderRef: key,
                logLineCount: last.lines.length,
                shopifyLineCount: shopifyLines.length,
                logLinesMatchedShopify: logIdsMatched,
              },
            );
          }

          const byLine: ReturnPageResume["byLine"] = {};
          for (const kl of shopifyLines) {
            const match = logLineById.get(kl.id);
            if (match) {
              byLine[kl.id] = {
                reason: match.reason,
                disposition: normalizeReturnLineDisposition(match.disposition),
                notes: match.notes?.trim() ? match.notes : "",
              };
            } else {
              byLine[kl.id] = {
                reason: null,
                disposition: "restock",
                notes: "",
              };
            }
          }

          const shopifyOrder = toShopifyOrderDisplay(order);
          return {
            lines: shopifyLines,
            resume: {
              source: "returnLog",
              returnUid: last.returnUid,
              customerEmailSent: last.customerEmailSent,
              fullRefundIssued: last.fullRefundIssued,
              ...(typeof last.loggedByOperator === "string" &&
              last.loggedByOperator.trim()
                ? { loggedByOperator: last.loggedByOperator.trim() }
                : {}),
              byLine,
            },
            formContext: { kind: "returnLog" },
            bareLineSource: null,
            shopifyOrder,
          };
        }
      }
    }

    const skus = [...new Set(last.lines.map((l) => l.sku))];
    const thumbs = await getThumbnailsBySkus(skus);

    let lines: KokobayOrderLine[] = last.lines.map((l) => ({
      id: l.lineId,
      sku: l.sku,
      title: l.title,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      imageUrl: thumbs.get(l.sku) ?? "",
    }));

    if (process.env.SHOPIFY_STORE?.trim()) {
      lines = await enrichKokobayOrderLinesWithShopify(key, lines);
    }

    const byLine: ReturnPageResume["byLine"] = Object.fromEntries(
      last.lines.map((l) => [
        l.lineId,
        {
          reason: l.reason,
          disposition: normalizeReturnLineDisposition(l.disposition),
          notes: l.notes?.trim() ? l.notes : "",
        },
      ]),
    );

    const shopifyOrder = process.env.SHOPIFY_STORE?.trim()
      ? await fetchShopifyOrderDisplay(key)
      : null;
    return {
      lines,
      resume: {
        source: "returnLog",
        returnUid: last.returnUid,
        customerEmailSent: last.customerEmailSent,
        fullRefundIssued: last.fullRefundIssued,
        ...(typeof last.loggedByOperator === "string" && last.loggedByOperator.trim()
          ? { loggedByOperator: last.loggedByOperator.trim() }
          : {}),
        byLine,
      },
      formContext: { kind: "returnLog" },
      bareLineSource: null,
      shopifyOrder,
    };
  }

  const form = await getLatestCustomerReturnFormForOrder(key);
  if (form?.items.length) {
    const skus = [...new Set(form.items.map((i) => i.sku))];
    const [thumbs, unitPrices] = await Promise.all([
      getThumbnailsBySkus(skus),
      getUnitPricesBySkus(skus),
    ]);

    const byLine: ReturnPageResume["byLine"] = {};
    let lines: KokobayOrderLine[] = form.items.map((i) => {
      const { disposition } = mapCustomerFormReasonToWarehouse(i.reasonValue);
      byLine[i.lineId] = {
        reason: i.reasonValue,
        disposition,
        notes: i.notes?.trim() ? i.notes : "",
      };
      return {
        id: i.lineId,
        sku: i.sku,
        title: i.title,
        quantity: i.quantity,
        unitPrice: unitPrices.get(i.sku) ?? 0,
        imageUrl: thumbs.get(i.sku) ?? "",
      } satisfies KokobayOrderLine;
    });

    if (process.env.SHOPIFY_STORE?.trim()) {
      lines = await enrichKokobayOrderLinesWithShopify(key, lines);
    }

    const shopifyOrder = process.env.SHOPIFY_STORE?.trim()
      ? await fetchShopifyOrderDisplay(key)
      : null;
    return {
      lines,
      resume: {
        source: "customerForm",
        customerFormSubmissionUid: form.submissionUid,
        customerEmailSent: false,
        fullRefundIssued: false,
        byLine,
      },
      formContext: {
        kind: "customerForm",
        submissionUid: form.submissionUid,
        datePosted: form.datePosted,
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        submittedAtIso: form.createdAt.toISOString(),
      },
      bareLineSource: null,
      shopifyOrder,
    };
  }

  if (process.env.SHOPIFY_STORE?.trim()) {
    try {
      const s = await fetchReturnOrderFromShopify(key);
      if (s.ok) {
        return {
          lines: s.lines,
          resume: null,
          formContext: { kind: "noFormOnFile" },
          bareLineSource: {
            type: "shopify",
            orderRef: s.orderRef,
            shopifyOrderId: s.shopifyOrderId,
          },
          shopifyOrder: shopifyOrderDisplayFromLookup(s),
        };
      }
      if (s.error === "not_found") {
        return {
          lines: [],
          resume: null,
          formContext: { kind: "noFormOnFile" },
          bareLineSource: { type: "shopify_not_found" },
          shopifyOrder: null,
        };
      }
      return {
        lines: [],
        resume: null,
        formContext: { kind: "noFormOnFile" },
        bareLineSource: { type: "shopify_unavailable" },
        shopifyOrder: null,
      };
    } catch (e) {
      console.error("[getReturnPageLinesAndResume] shopify", e);
      return {
        lines: [],
        resume: null,
        formContext: { kind: "noFormOnFile" },
        bareLineSource: { type: "shopify_unavailable" },
        shopifyOrder: null,
      };
    }
  }

  const lines = await getReturnOrderLinesFromProducts(key);
  return {
    lines,
    resume: null,
    formContext: { kind: "noFormOnFile" },
    bareLineSource: { type: "sample" },
    shopifyOrder: null,
  };
}
