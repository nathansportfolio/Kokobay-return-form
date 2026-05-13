import { NextResponse } from "next/server";
import {
  getReturnLogByUid,
  markReturnCustomerEmailSent,
  markReturnFullRefund,
  markReturnRefundedTrue,
} from "@/lib/returnLog";
import {
  parseSiteAccessRoleFromCookieHeader,
  parseWarehouseOperatorLabelFromCookieHeader,
} from "@/lib/siteAccess";

type PatchBody = {
  markEmailSent?: boolean;
  markFullRefund?: boolean;
  fullRefundAmountGbp?: number;
  markRefunded?: boolean;
};

/**
 * PATCH /api/returns/log/[returnUid]
 * Set customer email sent, full-refund flags, and/or **refunded** (warehouse reporting flag).
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
  const hasRefunded = body.markRefunded === true;
  if (!hasEmail && !hasRefund && !hasRefunded) {
    return NextResponse.json(
      { ok: false, error: "Set markEmailSent, markFullRefund, and/or markRefunded" },
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
  const markedByOperator = parseWarehouseOperatorLabelFromCookieHeader(
    request.headers.get("cookie"),
  );
  const auditOpts =
    markedByRole || markedByOperator
      ? {
          ...(markedByRole ? { markedByRole } : {}),
          ...(markedByOperator ? { markedByOperator } : {}),
        }
      : undefined;

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
    if (hasRefunded) {
      const okRef = await markReturnRefundedTrue(returnUid);
      if (!okRef) {
        return NextResponse.json(
          { ok: false, error: "Could not mark refunded" },
          { status: 500 },
        );
      }
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
