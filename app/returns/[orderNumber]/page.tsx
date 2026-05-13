import type { Metadata } from "next";
import Link from "next/link";
import { OrderReturnLines } from "@/components/OrderReturnLines";
import {
  ReturnPageStatusToast,
  type ReturnPageLoadToastHint,
} from "@/components/ReturnPageStatusToast";
import {
  getReturnPageLinesAndResume,
  type ReturnPageFormContext,
  type ReturnPageBareLineSource,
} from "@/lib/returnPageContext";
import { resolveOrderRefFromPathSegment } from "@/lib/orderRefAliases";
import { fetchShopifyOrderDisplay } from "@/lib/shopifyReturnOrderLookup";
import { cookies } from "next/headers";
import {
  WAREHOUSE_OPERATOR_COOKIE,
  parseWarehouseOperatorLabelFromEncodedValue,
} from "@/lib/siteAccess";

function firstNameForKlaviyo(input: {
  customerFirstName: string;
  customerName: string;
  email: string;
}): string {
  const direct = input.customerFirstName.trim();
  if (direct) return direct;
  const full = input.customerName.trim();
  if (full && full !== "—") {
    const token = full.split(/\s+/)[0];
    if (token) return token;
  }
  const local = input.email.split("@")[0]?.trim();
  return local || "Customer";
}

type PageProps = {
  params: Promise<{ orderNumber: string }>;
};

function labelFromRouteParam(orderNumber: string) {
  try {
    return resolveOrderRefFromPathSegment(decodeURIComponent(orderNumber));
  } catch {
    return resolveOrderRefFromPathSegment(orderNumber);
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { orderNumber } = await params;
  const label = labelFromRouteParam(orderNumber);
  if (process.env.SHOPIFY_STORE?.trim()) {
    const d = await fetchShopifyOrderDisplay(label);
    if (d) {
      return {
        title: `Return · ${d.orderName} · KOKObay`,
        description: `Warehouse return for ${d.orderName} (${d.shopifyOrderNumber})`,
      };
    }
  }
  return {
    title: `Return · ${label} · KOKObay`,
    description: `Process return for order ${label}`,
  };
}

function formatShopifyTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: "Europe/London",
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default async function OrderReturnPage({ params }: PageProps) {
  const { orderNumber } = await params;
  const label = labelFromRouteParam(orderNumber);

  let lines: Awaited<ReturnType<typeof getReturnPageLinesAndResume>>["lines"] =
    [];
  let resume: Awaited<
    ReturnType<typeof getReturnPageLinesAndResume>
  >["resume"] = null;
  let formContext: ReturnPageFormContext = { kind: "noFormOnFile" };
  let bareLineSource: ReturnPageBareLineSource = null;
  let shopifyOrder: Awaited<
    ReturnType<typeof getReturnPageLinesAndResume>
  >["shopifyOrder"] = null;
  let loadError: string | null = null;
  try {
    const r = await getReturnPageLinesAndResume(label);
    lines = r.lines;
    resume = r.resume;
    formContext = r.formContext;
    bareLineSource = r.bareLineSource;
    shopifyOrder = r.shopifyOrder;
  } catch {
    loadError = "Could not load data. Check MongoDB and app logs, then try again.";
  }

  const orderTitle = shopifyOrder?.orderName ?? label;
  const orderIdForLink = shopifyOrder?.shopifyOrderId;

  const notifyCustomer =
    shopifyOrder?.email?.trim()
      ? {
          email: shopifyOrder.email.trim(),
          firstName: firstNameForKlaviyo({
            customerFirstName: shopifyOrder.customerFirstName ?? "",
            customerName: shopifyOrder.customerName,
            email: shopifyOrder.email.trim(),
          }),
        }
      : formContext.kind === "customerForm" &&
          formContext.customerEmail?.trim()
        ? {
            email: formContext.customerEmail.trim(),
            firstName: firstNameForKlaviyo({
              customerFirstName: "",
              customerName: formContext.customerName,
              email: formContext.customerEmail.trim(),
            }),
          }
        : null;

  const cookieStore = await cookies();
  const currentOperatorLabel = parseWarehouseOperatorLabelFromEncodedValue(
    cookieStore.get(WAREHOUSE_OPERATOR_COOKIE)?.value ?? null,
  );

  const loadToastHint: ReturnPageLoadToastHint =
    !loadError && lines.length === 0
      ? bareLineSource?.type === "shopify_not_found"
        ? "shopify_not_found"
        : bareLineSource?.type === "shopify_unavailable"
          ? "shopify_unavailable"
          : bareLineSource?.type === "sample"
            ? "sample_catalog"
            : null
      : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <ReturnPageStatusToast hint={loadToastHint} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Order return
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {shopifyOrder
            ? "Data below is from Shopify. Match what the customer was charged."
            : "Women’s wear on this order — mark what is coming back and how to handle it."}
        </p>
      </div>

      {shopifyOrder && !loadError ? (
        <div
          className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/30"
          aria-label="Shopify order"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Shopify order
          </p>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
            <p className="text-lg font-semibold text-foreground">
              {shopifyOrder.orderName}
            </p>
            <span
              className="font-mono text-xs text-zinc-500"
              title="Admin order id"
            >
              id {shopifyOrder.shopifyOrderId} · # {shopifyOrder.shopifyOrderNumber}
            </span>
          </div>
          <p className="text-zinc-800 dark:text-zinc-200">
            <span className="text-zinc-500">Customer · </span>
            {shopifyOrder.customerName}
            {shopifyOrder.email ? (
              <>
                {" "}
                ·{" "}
                <a
                  href={`mailto:${encodeURIComponent(shopifyOrder.email)}`}
                  className="text-amber-800 underline dark:text-amber-200/90"
                >
                  {shopifyOrder.email}
                </a>
              </>
            ) : null}
          </p>
          <p className="text-zinc-600 dark:text-zinc-400">
            {shopifyOrder.financialStatus.replace(/_/g, " ")}
            {shopifyOrder.fulfillmentStatus
              ? ` · ${shopifyOrder.fulfillmentStatus.replace(/_/g, " ")}`
              : null}
            {" · "}
            {new Intl.NumberFormat("en-GB", {
              style: "currency",
              currency: shopifyOrder.currency || "GBP",
            }).format(Number(shopifyOrder.totalPrice) || 0)}
            {shopifyOrder.createdAt
              ? ` · placed ${formatShopifyTime(shopifyOrder.createdAt)}`
              : null}
          </p>
        </div>
      ) : null}

      {!loadError && formContext.kind === "customerForm" ? (
        <div
          className="rounded-lg border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm dark:border-sky-900/50 dark:bg-sky-950/40"
          role="status"
        >
          <p className="font-medium text-sky-950 dark:text-sky-100">
            Customer return form on file
          </p>
          <p className="mt-1.5 text-sky-900/90 dark:text-sky-200/90">
            Lines and reasons are from their online form (parcel posted{" "}
            {formContext.datePosted}
            {formContext.submittedAtIso
              ? ` · submitted ${new Date(formContext.submittedAtIso).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" })}`
              : null}
            ) · {formContext.customerName} · {formContext.customerEmail}
            {shopifyOrder?.email && shopifyOrder.email !== formContext.customerEmail
              ? (
                <span className="mt-1 block text-xs text-sky-800/90 dark:text-sky-200/80">
                  Shopify order email: {shopifyOrder.email}
                </span>
              ) : null}
          </p>
        </div>
      ) : null}

      {!loadError && formContext.kind === "noFormOnFile" && lines.length > 0 ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30"
          role="status"
        >
          <p className="font-medium text-amber-950 dark:text-amber-100">
            No customer return form on file
          </p>
          {bareLineSource?.type === "shopify" ? (
            <p className="mt-1.5 text-amber-900/90 dark:text-amber-200/85">
              Line items and unit prices are from the Shopify order{" "}
              {bareLineSource.orderRef}.{" "}
              {shopifyOrder
                ? `Customer name and email in the block above are from the same order.`
                : null}
            </p>
          ) : null}
        </div>
      ) : null}

      {loadError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      ) : lines.length === 0 ? (
        (() => {
          if (bareLineSource?.type === "shopify_not_found") {
            return (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                We could not find this order in Shopify. Use the name from the
                confirmation (e.g. <strong className="font-mono">#1001</strong>
                ), the <strong>order</strong> number, or the long
                <strong> id</strong> from order admin, then{" "}
                <Link href="/returns" className="font-medium underline">
                  search again
                </Link>
                . No return log or customer return form for this ref either.
              </p>
            );
          }
          if (bareLineSource?.type === "shopify_unavailable") {
            return (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Shopify is configured but the order could not be loaded. Check
                <code className="mx-1 rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                  SHOPIFY_*
                </code>
                credentials and re-open the page, or start from{" "}
                <Link href="/returns" className="font-medium underline">
                  order search
                </Link>
                .
              </p>
            );
          }
          return (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {bareLineSource?.type === "sample" ? (
                <>
                  This environment has no working Shopify line lookup, so sample
                  products from the database are shown. Set{" "}
                  <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                    SHOPIFY_STORE
                  </code>{" "}
                  and admin credentials, or post to{" "}
                  <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                    /api/warehouse/seed-mock-products
                  </code>{" "}
                  for a dev catalog, or{" "}
                </>
              ) : null}
              <Link href="/returns" className="font-medium underline">
                try another order
              </Link>
              .{" "}
              {formContext.kind === "noFormOnFile" ? (
                <span className="block pt-2 text-zinc-500">
                  No customer return form for this order was found either.
                </span>
              ) : null}
            </p>
          );
        })()
      ) : (
        <OrderReturnLines
          key={`${orderTitle}::${resume?.returnUid ?? resume?.customerFormSubmissionUid ?? "new"}`}
          orderLabel={orderTitle}
          shopifyOrderId={orderIdForLink}
          lines={lines}
          resume={resume}
          notifyCustomer={notifyCustomer}
          currentOperatorLabel={currentOperatorLabel}
        />
      )}
    </div>
  );
}
