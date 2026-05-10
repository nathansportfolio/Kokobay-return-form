import {
  type CartIntelligenceBucketReport,
  type CartIntelligenceEventDoc,
  getCartIntelligenceReport,
  listCartIntelligenceEvents,
  parseReportRange,
} from "@/lib/cartIntelligence";

export const dynamic = "force-dynamic";

function conversionRate(bucket: CartIntelligenceBucketReport): number {
  if (bucket.add_to_cart_count <= 0) return 0;
  return Math.round(
    (bucket.checkout_completed_count / bucket.add_to_cart_count) * 10_000,
  ) / 100;
}

function logBucket(bucket: CartIntelligenceBucketReport) {
  return {
    add_to_cart_count: bucket.add_to_cart_count,
    checkout_started_count: bucket.checkout_started_count,
    checkout_completed_count: bucket.checkout_completed_count,
    conversion_rate: conversionRate(bucket),
    abandonment_rate: bucket.abandonment_rate,
  };
}

function dominantCohortFor(
  events: CartIntelligenceEventDoc[],
): "last_one" | "low_stock" | "normal" {
  const buckets = new Set(events.map((e) => e.stock_bucket));
  if (buckets.has("last_one")) return "last_one";
  if (buckets.has("low_stock")) return "low_stock";
  return "normal";
}

/**
 * Print every DB event in the report window to stdout, plus a per-session
 * summary that mirrors the dominant-cohort logic in the aggregation. Useful
 * when triaging "why is this session in cohort X?" questions.
 *
 * Set `CART_INTELLIGENCE_LOG_EVENTS_DUMP=0` to silence in production.
 */
async function dumpEventsToConsole(range: {
  from: Date | null;
  to: Date | null;
}): Promise<void> {
  const events = await listCartIntelligenceEvents(range);

  const fmt = (e: CartIntelligenceEventDoc) =>
    [
      e.created_at.toISOString(),
      e.event_name.padEnd(22),
      `session=${e.session_id}`,
      `variant=${e.variant_id ?? "-"}`,
      `inv=${e.inventory_remaining ?? "-"}`,
      `bucket=${e.stock_bucket}`,
      `src=${e.inventory_source}`,
    ].join("  ");

  console.log(
    `[cart-intelligence/report] db events (${events.length}) from=${
      range.from?.toISOString() ?? "∞"
    } to=${range.to?.toISOString() ?? "now"}`,
  );
  for (const e of events) console.log("  " + fmt(e));

  // Per-session view: shows which cohort each session_id is pinned to.
  const sessions = new Map<string, CartIntelligenceEventDoc[]>();
  for (const e of events) {
    const arr = sessions.get(e.session_id) ?? [];
    arr.push(e);
    sessions.set(e.session_id, arr);
  }
  const sessionRows = [...sessions.entries()].map(([sid, evts]) => ({
    session_id: sid,
    dominant_cohort: dominantCohortFor(evts),
    added: evts.some((e) => e.event_name === "product_added_to_cart"),
    started: evts.some((e) => e.event_name === "checkout_started"),
    completed: evts.some((e) => e.event_name === "checkout_completed"),
    events: evts.length,
    buckets_touched: [...new Set(evts.map((e) => e.stock_bucket))],
  }));
  console.log(
    `[cart-intelligence/report] sessions (${sessionRows.length}):`,
    sessionRows,
  );
}

/**
 * `GET /api/cart-intelligence/report?from=ISO&to=ISO`
 *
 * Returns abandonment rates per stock bucket (low_stock / last_one / normal)
 * plus an overall figure. Auth: site PIN (middleware) — internal admin use.
 *
 * Default window is the trailing 30 days when no `from` is given.
 */
export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const range = parseReportRange(sp);
    const report = await getCartIntelligenceReport(range);

    // Dashboard sanity log: this is the exact data powering the
    // /admin/cart-intelligence cards and cohort breakdown table.
    // Set CART_INTELLIGENCE_LOG_REPORT=0 to silence in production.
    if (process.env.CART_INTELLIGENCE_LOG_REPORT !== "0") {
      console.log("[cart-intelligence/report] dashboard metrics:", {
        grouping: {
          canonical_key: "session_id",
          cohort_rule: "last_one > low_stock > normal",
          exclusive_cohort_per_session: true,
        },
        date_range: report.date_range,
        total_sessions: report.total_sessions,
        total_events: report.total_events,
        last_one: logBucket(report.last_one),
        low_stock: logBucket(report.low_stock),
        normal: logBucket(report.normal),
        overall: logBucket(report.overall),
      });
    }

    if (process.env.CART_INTELLIGENCE_LOG_EVENTS_DUMP !== "0") {
      // Best-effort: never fail the report response just because logging blew up.
      try {
        await dumpEventsToConsole(range);
      } catch (err) {
        console.warn(
          "[cart-intelligence/report] events dump failed:",
          err instanceof Error ? err.message : err,
        );
      }
    }

    return Response.json(
      { ok: true, report },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
