import { NextResponse } from "next/server";
import {
  insertCustomerReturnForm,
  validateCustomerReturnForm,
} from "@/lib/customerReturnFormSubmission";

/**
 * POST /api/returns/customer-form
 * Store a customer packing-slip return form submission in `customerReturnForms`.
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
