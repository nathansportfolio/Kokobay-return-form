import { NextResponse } from "next/server";
import { postKlaviyoCreateEvent } from "@/lib/klaviyoPostEvent";

export const dynamic = "force-dynamic";

const METRIC_NAME = "Return Received";

type Body = {
  email?: unknown;
  firstName?: unknown;
  orderId?: unknown;
  refundAmount?: unknown;
};

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

function looksLikeEmail(s: string): boolean {
  const t = s.trim();
  const at = t.lastIndexOf("@");
  return at > 0 && at < t.length - 1;
}

/**
 * POST /api/klaviyo/return-received
 * Server-side Klaviyo “Return Received” event (metric + profile + properties).
 * Requires site PIN cookie when `NEXT_PUBLIC_SITE_PIN_*` is configured (middleware).
 *
 * Body: { email, firstName, orderId, refundAmount } — strings, all required.
 */
export async function POST(request: Request) {
  const apiKey = process.env.KOKO_RETURN?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Klaviyo is not configured (KOKO_RETURN)" },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const email = isNonEmptyString(body.email) ? body.email.trim() : "";
  const firstName = isNonEmptyString(body.firstName) ? body.firstName.trim() : "";
  const orderId = isNonEmptyString(body.orderId) ? body.orderId.trim() : "";
  const refundAmount = isNonEmptyString(body.refundAmount)
    ? body.refundAmount.trim()
    : "";

  if (!email || !looksLikeEmail(email)) {
    return NextResponse.json({ ok: false, error: "email is required" }, { status: 400 });
  }
  if (!firstName) {
    return NextResponse.json({ ok: false, error: "firstName is required" }, { status: 400 });
  }
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "orderId is required" }, { status: 400 });
  }
  if (!refundAmount) {
    return NextResponse.json({ ok: false, error: "refundAmount is required" }, { status: 400 });
  }

  const result = await postKlaviyoCreateEvent({
    apiKey,
    metricName: METRIC_NAME,
    properties: {
      customerName: firstName,
      orderId,
      refundAmount,
    },
    profile: { email, first_name: firstName },
    logTag: "[klaviyo/return-received]",
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          result.httpStatus === 0
            ? "Could not reach Klaviyo"
            : "Klaviyo rejected the event",
        ...(result.responseText ? { detail: result.responseText.slice(0, 500) } : {}),
      },
      {
        status:
          result.httpStatus >= 400 && result.httpStatus < 600 ? result.httpStatus : 502,
      },
    );
  }

  const at = email.indexOf("@");
  const emailHint =
    at > 1 ? `${email.slice(0, 2)}…@${email.slice(at + 1)}` : "(set)";
  console.log("[klaviyo/return-received] sent OK", {
    metric: METRIC_NAME,
    orderId,
    firstName,
    refundAmount,
    emailHint,
    httpStatus: result.httpStatus,
  });

  return NextResponse.json({ ok: true });
}
