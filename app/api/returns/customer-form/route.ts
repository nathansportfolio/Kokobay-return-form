import { NextResponse } from "next/server";
import {
  insertCustomerReturnForm,
  validateCustomerReturnForm,
} from "@/lib/customerReturnFormSubmission";
import { fetchReturnOrderFromShopify } from "@/lib/shopifyReturnOrderLookup";

/**
 * POST /api/returns/customer-form
 * Store a customer packing-slip return form submission in `customerReturnForms`.
 * When `SHOPIFY_STORE` is set, the order must resolve in the Shopify Admin API
 * (same as the return form “Load order” check).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const v = validateCustomerReturnForm(body);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
  }
  if (process.env.SHOPIFY_STORE?.trim()) {
    const shopify = await fetchReturnOrderFromShopify(v.data.orderRef);
    if (!shopify.ok) {
      if (shopify.error === "not_found") {
        return NextResponse.json(
          {
            ok: false,
            error:
              "We could not find that order in our store. Load it in the return form first to confirm, then try again.",
          },
          { status: 400 },
        );
      }
      if (shopify.error === "other") {
        return NextResponse.json(
          { ok: false, error: shopify.message ?? "Order lookup failed" },
          { status: 400 },
        );
      }
    } else {
      const allowed = new Set(shopify.lines.map((l) => l.id));
      for (const item of v.data.items) {
        if (!allowed.has(item.lineId)) {
          return NextResponse.json(
            { ok: false, error: "This submission does not match the order lines. Please reload the form." },
            { status: 400 },
          );
        }
      }
    }
  }
  try {
    const submissionUid = await insertCustomerReturnForm(v.data);
    return NextResponse.json({ ok: true, submissionUid });
  } catch (e) {
    console.error("[customer-form]", e);
    return NextResponse.json(
      { ok: false, error: "Could not save your form" },
      { status: 500 },
    );
  }
}
