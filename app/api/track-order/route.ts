import { NextResponse } from "next/server";

import { API_JSON_NO_STORE_HEADERS } from "@/lib/apiCacheHeaders";
import {
  trackOrderCorsHeaders,
  trackOrderCorsPreflight,
} from "@/lib/trackOrderCors";
import { lookupTrackOrder } from "@/lib/trackOrder";
import type { TrackOrderApiResponse } from "@/types/trackOrder";

export const dynamic = "force-dynamic";

const NOT_FOUND_MESSAGE =
  "We couldn't find an order matching that order number and email.";

function responseHeaders(req: Request): HeadersInit {
  return {
    ...API_JSON_NO_STORE_HEADERS,
    ...trackOrderCorsHeaders(req),
  };
}

function parseBody(value: unknown): { orderNumber: string; email: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const orderNumber = String(
    body.orderNumber ?? body.order_number ?? body.order ?? "",
  ).trim();
  const email = String(body.email ?? body.emailAddress ?? "").trim();
  if (!orderNumber || !email) return null;
  return { orderNumber, email };
}

export async function OPTIONS(request: Request) {
  return trackOrderCorsPreflight(request);
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    const body: TrackOrderApiResponse = {
      ok: false,
      error: "Invalid JSON body",
      code: "invalid_input",
    };
    return NextResponse.json(body, { status: 400, headers: responseHeaders(request) });
  }

  const input = parseBody(json);
  if (!input) {
    const body: TrackOrderApiResponse = {
      ok: false,
      error: "Order number and email are required",
      code: "invalid_input",
    };
    return NextResponse.json(body, { status: 400, headers: responseHeaders(request) });
  }

  try {
    const result = await lookupTrackOrder(input.orderNumber, input.email);
    if (result.ok) {
      return NextResponse.json(result.data, { headers: responseHeaders(request) });
    }

    if (result.code === "not_configured") {
      const body: TrackOrderApiResponse = {
        ok: false,
        error: "Order tracking is not available right now.",
        code: "not_configured",
      };
      return NextResponse.json(body, { status: 503, headers: responseHeaders(request) });
    }

    if (result.code === "invalid_input") {
      const body: TrackOrderApiResponse = {
        ok: false,
        error: "Enter a valid order number and email address.",
        code: "invalid_input",
      };
      return NextResponse.json(body, { status: 400, headers: responseHeaders(request) });
    }

    const body: TrackOrderApiResponse = {
      ok: false,
      error: NOT_FOUND_MESSAGE,
      code: "not_found",
    };
    return NextResponse.json(body, { status: 404, headers: responseHeaders(request) });
  } catch (err) {
    console.error("[track-order]", err);
    const body: TrackOrderApiResponse = {
      ok: false,
      error: "Could not look up your order. Try again in a moment.",
      code: "failed",
    };
    return NextResponse.json(body, { status: 500, headers: responseHeaders(request) });
  }
}
