import type { Filter } from "mongodb";
import {
  CART_INTELLIGENCE_EVENTS_COLLECTION,
  type CartIntelligenceEventDoc,
  parseReportRange,
} from "@/lib/cartIntelligence";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { fetchShopifyVariantInventory } from "@/lib/shopifyVariantInventory";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

/**
 * `GET /api/cart-intelligence/diagnostic?variant_id=...&session_id=...&product_id=...&from=ISO&to=ISO&limit=50`
 *
 * Internal sanity-check endpoint for cart-intelligence triage. PIN-gated by
 * the global `proxy.ts` (only `/event` is whitelisted). Use it to answer
 * questions like:
 *   - “Did our pixel actually fire for this cart?”
 *   - “What stock bucket did variant N land in?”
 *   - “Did Shopify enrichment hit or fail?”
 *
 * Returns the matching event documents (most recent first), the live Shopify
 * inventory we’d enrich with right now, and a quick cohort tally for those
 * matches so you can spot bucket misclassification at a glance.
 */
export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const range = parseReportRange(sp);

    const variant_id = sp.get("variant_id")?.trim() || null;
    const session_id = sp.get("session_id")?.trim() || null;
    const product_id = sp.get("product_id")?.trim() || null;

    const limitParam = Number.parseInt(sp.get("limit") ?? "", 10);
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, MAX_LIMIT)
        : DEFAULT_LIMIT;

    if (!variant_id && !session_id && !product_id) {
      return Response.json(
        {
          ok: false,
          error:
            "Provide at least one of: variant_id, session_id, product_id.",
          example:
            "/api/cart-intelligence/diagnostic?variant_id=43092839858229",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const filter: Filter<CartIntelligenceEventDoc> = {};
    if (range.from || range.to) {
      const createdAt: { $gte?: Date; $lte?: Date } = {};
      if (range.from) createdAt.$gte = range.from;
      if (range.to) createdAt.$lte = range.to;
      filter.created_at = createdAt;
    }
    if (variant_id) {
      // Match both numeric ("43092839858229") and GID variants we might have
      // ingested at different points in the pipeline.
      filter.variant_id = {
        $in: [
          variant_id,
          `gid://shopify/ProductVariant/${variant_id.replace(/^gid:\/\/shopify\/ProductVariant\//i, "")}`,
        ],
      };
    }
    if (session_id) filter.session_id = session_id;
    if (product_id) filter.product_id = product_id;

    const client = await clientPromise;
    const col = client
      .db(kokobayDbName)
      .collection<CartIntelligenceEventDoc>(
        CART_INTELLIGENCE_EVENTS_COLLECTION,
      );

    const events = await col
      .find(filter, {
        projection: { ip_hash: 0, user_agent: 0 },
      })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();

    const cohorts = {
      last_one: events.filter((e) => e.stock_bucket === "last_one").length,
      low_stock: events.filter((e) => e.stock_bucket === "low_stock").length,
      normal: events.filter((e) => e.stock_bucket === "normal").length,
    };
    const eventBreakdown = {
      product_added_to_cart: events.filter(
        (e) => e.event_name === "product_added_to_cart",
      ).length,
      checkout_started: events.filter((e) => e.event_name === "checkout_started")
        .length,
      checkout_completed: events.filter(
        (e) => e.event_name === "checkout_completed",
      ).length,
    };
    const sessions = new Set(events.map((e) => e.session_id));

    // Mirror the report aggregation: pin each session to its most-restricted
    // bucket so triage matches what the dashboard shows. last_one > low_stock > normal.
    const sessionCohorts = [...sessions].map((sid) => {
      const sessionEvents = events.filter((e) => e.session_id === sid);
      const buckets = new Set(sessionEvents.map((e) => e.stock_bucket));
      const cohort = buckets.has("last_one")
        ? "last_one"
        : buckets.has("low_stock")
          ? "low_stock"
          : "normal";
      const has = (n: string) =>
        sessionEvents.some((e) => e.event_name === n);
      return {
        session_id: sid,
        cohort,
        added_to_cart: has("product_added_to_cart"),
        checkout_started: has("checkout_started"),
        checkout_completed: has("checkout_completed"),
        buckets_touched: [...buckets],
        events: sessionEvents.length,
      };
    });
    const inventorySources = events.reduce<Record<string, number>>(
      (acc, e) => {
        acc[e.inventory_source] = (acc[e.inventory_source] ?? 0) + 1;
        return acc;
      },
      {},
    );

    // Live look-up so the operator can compare “what we stored when the
    // event came in” to “what Shopify says right now”. Skipped if no
    // variant id was specified or it’s unparseable.
    const liveShopify = variant_id
      ? await fetchShopifyVariantInventory(variant_id)
      : null;

    return Response.json(
      {
        ok: true,
        filter: {
          variant_id,
          session_id,
          product_id,
          from: range.from ? range.from.toISOString() : null,
          to: range.to ? range.to.toISOString() : null,
          limit,
        },
        summary: {
          total_events: events.length,
          unique_sessions: sessions.size,
          cohorts,
          events: eventBreakdown,
          inventory_sources: inventorySources,
        },
        session_cohorts: sessionCohorts,
        live_shopify_inventory: liveShopify,
        events,
      },
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
