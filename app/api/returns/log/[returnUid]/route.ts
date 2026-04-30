import { NextResponse } from "next/server";
import {
  getReturnLogByUid,
  markReturnCustomerEmailSent,
  markReturnFullRefund,
} from "@/lib/returnLog";
import { parseSiteAccessRoleFromCookieHeader } from "@/lib/siteAccess";

type PatchBody = {
  markEmailSent?: boolean;
  markFullRefund?: boolean;
  fullRefundAmountGbp?: number;
};

/**
 * PATCH /api/returns/log/[returnUid]
 * Set customer email sent and/or full-refund flags for a registered return.
 */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ returnUid: string }> },
) {
  const { returnUid: rawUid } = await ctx.params;
  const returnUid = String(rawUid ?? "").trim();
  if (!returnUid) {
    return NextResponse.json(
      { ok: false, error: "returnUid is required" },
      { status: 400 },
    );
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const hasEmail = body.markEmailSent === true;
  const hasRefund = body.markFullRefund === true;
  if (!hasEmail && !hasRefund) {
    return NextResponse.json(
      { ok: false, error: "Set markEmailSent and/or markFullRefund" },
      { status: 400 },
    );
  }

  const existing = await getReturnLogByUid(returnUid);
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "Return not found" },
      { status: 404 },
    );
  }

  const markedByRole = parseSiteAccessRoleFromCookieHeader(
    request.headers.get("cookie"),
  );
  const auditOpts = markedByRole ? { markedByRole } : undefined;

  try {
    if (hasEmail) {
      await markReturnCustomerEmailSent(returnUid, auditOpts);
    }
    if (hasRefund) {
      const amt = Number(body.fullRefundAmountGbp);
      if (Number.isNaN(amt) || amt < 0) {
        return NextResponse.json(
          { ok: false, error: "fullRefundAmountGbp must be a non-negative number" },
          { status: 400 },
        );
      }
      await markReturnFullRefund(returnUid, amt, auditOpts);
    }
    const fresh = await getReturnLogByUid(returnUid);
    return NextResponse.json({ ok: true, return: fresh });
  } catch (e) {
    console.error("[returns/log/patch]", e);
    return NextResponse.json(
      { ok: false, error: "Update failed" },
      { status: 500 },
    );
  }
}
