import { NextResponse } from "next/server";
import { postKlaviyoCreateEvent } from "@/lib/klaviyoPostEvent";

export const dynamic = "force-dynamic";

/** Matches warehouse UI copy (“Return Submitted” Klaviyo flow). */
const METRIC_NAME = "Return Submitted";

type ReturnItem = {
  name?: unknown;
  size?: unknown;
  reason?: unknown;
};

type Body = {
  email?: unknown;
  firstName?: unknown;
  orderId?: unknown;
  items?: unknown;
};

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

function looksLikeEmail(s: string): boolean {
  const t = s.trim();
  const at = t.lastIndexOf("@");
  return at > 0 && at < t.length - 1;
}

function isReturnItemRow(x: unknown): x is { name: string; size: string; reason: string } {
  if (!x || typeof x !== "object") return false;
  const o = x as ReturnItem;
  return (
    typeof o.name === "string" &&
    typeof o.size === "string" &&
    typeof o.reason === "string"
  );
}

/**
 * POST /api/klaviyo/return-rejected
 * Server-side Klaviyo “Return Submitted” event for rejected line items.
 * Body: { email, firstName, orderId, items: { name, size, reason }[] }.
 * Event properties flatten each item to primitives: item1Name, item1Size, item1Reason, …
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

  if (!email || !looksLikeEmail(email)) {
    return NextResponse.json({ ok: false, error: "email is required" }, { status: 400 });
  }
  if (!firstName) {
    return NextResponse.json({ ok: false, error: "firstName is required" }, { status: 400 });
  }
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "orderId is required" }, { status: 400 });
  }

  const rawItems = body.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json(
      { ok: false, error: "items must be a non-empty array" },
      { status: 400 },
    );
  }
  if (!rawItems.every(isReturnItemRow)) {
    return NextResponse.json(
      {
        ok: false,
        error: "each item must be { name: string, size: string, reason: string }",
      },
      { status: 400 },
    );
  }
  const items = rawItems;

  const properties: Record<string, unknown> = {
    customerName: firstName,
    orderId,
  };

  items.forEach((item, index) => {
    const n = index + 1;
    properties[`item${n}Name`] = item.name;
    properties[`item${n}Size`] = item.size;
    properties[`item${n}Reason`] = item.reason;
  });

  const result = await postKlaviyoCreateEvent({
    apiKey,
    metricName: METRIC_NAME,
    properties,
    profile: { email, first_name: firstName },
    logTag: "[klaviyo/return-rejected]",
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
  console.log("[klaviyo/return-rejected] sent OK", {
    metric: METRIC_NAME,
    orderId,
    firstName,
    itemCount: items.length,
    emailHint,
    httpStatus: result.httpStatus,
  });

  return NextResponse.json({ ok: true });
}
