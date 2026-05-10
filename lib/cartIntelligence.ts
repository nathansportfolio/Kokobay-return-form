import { createHash } from "node:crypto";
import type { Document, Filter } from "mongodb";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import {
  fetchShopifyVariantInventory,
  type VariantInventoryLookupResult,
} from "@/lib/shopifyVariantInventory";

/**
 * MongoDB collection storing every Cart Intelligence pixel event sent from
 * the Shopify storefront. Indexed by `(event_name, created_at)` for fast
 * report aggregation, and by `session_id` / `cart_token` /
 * `checkout_token` for cross-event joins.
 */
export const CART_INTELLIGENCE_EVENTS_COLLECTION = "cart_intelligence_events";

export const CART_INTELLIGENCE_EVENT_NAMES = [
  "product_added_to_cart",
  "checkout_started",
  "checkout_completed",
] as const;

export type CartIntelligenceEventName =
  (typeof CART_INTELLIGENCE_EVENT_NAMES)[number];

export const CART_INTELLIGENCE_STOCK_BUCKETS = [
  "low_stock",
  "last_one",
  "normal",
] as const;

export type CartIntelligenceStockBucket =
  (typeof CART_INTELLIGENCE_STOCK_BUCKETS)[number];

/**
 * How the `inventory_remaining` field was sourced for this row. Useful for
 * monitoring data quality (e.g. how often Shopify enrichment fell back).
 */
export type CartIntelligenceInventorySource =
  | "shopify_admin"
  | "shopify_admin_cached"
  | "pixel_hint"
  | "missing"
  | "shopify_admin_error";

/**
 * Persisted shape (matches the `cart_intelligence_events` collection).
 * We never store raw IPs — only a salted SHA-256 hash for spam/abuse triage.
 */
export interface CartIntelligenceEventDoc {
  event_name: CartIntelligenceEventName;
  session_id: string;
  cart_token: string | null;
  checkout_token: string | null;
  product_id: string | null;
  variant_id: string | null;
  product_title: string | null;
  variant_title: string | null;
  quantity: number | null;
  /**
   * Live `inventory_quantity` from Shopify Admin REST when we successfully
   * looked the variant up; otherwise the pixel’s hint (or null).
   */
  inventory_remaining: number | null;
  /** True when `inventory_remaining > 1 && inventory_remaining <= 7`. */
  low_stock: boolean;
  /** True when `inventory_remaining === 1`. */
  last_one: boolean;
  /** Derived bucket for fast aggregation in the report query. */
  stock_bucket: CartIntelligenceStockBucket;
  cart_value: number | null;
  currency: string | null;
  source: string;
  user_agent: string | null;
  /** Salted SHA-256 of the client IP (never stored raw). */
  ip_hash: string | null;
  /** Provenance of `inventory_remaining` so we can audit data quality. */
  inventory_source: CartIntelligenceInventorySource;
  created_at: Date;
}

export interface IncomingCartIntelligenceEvent {
  event_name: CartIntelligenceEventName;
  session_id: string;
  cart_token: string | null;
  checkout_token: string | null;
  product_id: string | null;
  variant_id: string | null;
  product_title: string | null;
  variant_title: string | null;
  quantity: number | null;
  inventory_remaining: number | null;
  low_stock: boolean;
  last_one: boolean;
  cart_value: number | null;
  currency: string | null;
  source: string;
  /** When provided by the pixel; rejected if outside the allowed clock skew. */
  client_timestamp: Date | null;
}

/** Maximum lengths to defend the collection from absurdly large strings. */
const MAX = {
  sessionId: 128,
  token: 256,
  productId: 64,
  productTitle: 500,
  variantTitle: 500,
  source: 64,
  currency: 8,
  userAgent: 512,
} as const;

const MAX_CART_VALUE = 1_000_000; // GBP
const MAX_QUANTITY = 1_000;
const MAX_INVENTORY = 10_000_000;
/** Clamp client timestamps that are wildly off (clock skew / replay attacks). */
const MAX_CLIENT_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

function clampStr(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function nullableStr(value: unknown, max: number): string | null {
  const s = clampStr(value, max);
  return s.length > 0 ? s : null;
}

function nullableInt(value: unknown, min: number, max: number): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < min) return null;
  if (r > max) return null;
  return r;
}

function nullableFiniteNumber(
  value: unknown,
  min: number,
  max: number,
): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < min) return null;
  if (n > max) return null;
  return n;
}

function asBool(v: unknown): boolean {
  if (v === true) return true;
  if (v === "true" || v === 1 || v === "1") return true;
  return false;
}

function isCartIntelligenceEventName(
  v: unknown,
): v is CartIntelligenceEventName {
  return (
    typeof v === "string" &&
    (CART_INTELLIGENCE_EVENT_NAMES as readonly string[]).includes(v)
  );
}

function parseClientTimestamp(raw: unknown): Date | null {
  if (raw == null) return null;
  let date: Date | null = null;
  if (raw instanceof Date) {
    date = raw;
  } else if (typeof raw === "number" && Number.isFinite(raw)) {
    date = new Date(raw);
  } else if (typeof raw === "string" && raw.trim() !== "") {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      date = d;
    }
  }
  if (!date || Number.isNaN(date.getTime())) return null;
  // Reject obviously-stale or future-skewed timestamps.
  const drift = Math.abs(date.getTime() - Date.now());
  if (drift > MAX_CLIENT_CLOCK_SKEW_MS) {
    return null;
  }
  return date;
}

/**
 * Recompute `low_stock` / `last_one` from `inventory_remaining` when present;
 * trust the pixel’s explicit boolean otherwise. Definitions:
 *   - `last_one` = inventory_remaining === 1
 *   - `low_stock` = inventory_remaining > 1 && inventory_remaining <= 7
 */
export function deriveStockFlags(input: {
  inventory_remaining: number | null;
  low_stock: boolean;
  last_one: boolean;
}): { low_stock: boolean; last_one: boolean } {
  if (typeof input.inventory_remaining === "number") {
    const inv = input.inventory_remaining;
    return {
      last_one: inv === 1,
      low_stock: inv > 1 && inv <= 7,
    };
  }
  // `last_one` and `low_stock` are mutually exclusive — prefer last_one.
  if (input.last_one) return { last_one: true, low_stock: false };
  return { last_one: false, low_stock: input.low_stock };
}

export function stockBucketFromFlags(flags: {
  low_stock: boolean;
  last_one: boolean;
}): CartIntelligenceStockBucket {
  if (flags.last_one) return "last_one";
  if (flags.low_stock) return "low_stock";
  return "normal";
}

export interface ValidatedEventResult {
  ok: true;
  data: IncomingCartIntelligenceEvent;
}

export interface ValidatedEventError {
  ok: false;
  error: string;
}

/**
 * Validates the JSON body posted by the Shopify Custom Pixel.
 * Rejects payloads with no usable join key (`session_id` is required so
 * abandonment can be measured per-visitor).
 */
export function validateCartIntelligenceEvent(
  body: unknown,
): ValidatedEventResult | ValidatedEventError {
  if (body == null || typeof body !== "object") {
    return { ok: false, error: "Invalid body" };
  }
  const o = body as Record<string, unknown>;

  if (!isCartIntelligenceEventName(o.event_name)) {
    return {
      ok: false,
      error:
        "event_name must be one of: product_added_to_cart, checkout_started, checkout_completed",
    };
  }

  const session_id = clampStr(o.session_id, MAX.sessionId);
  if (!session_id) {
    return { ok: false, error: "session_id is required" };
  }

  const flagsRaw = {
    inventory_remaining: nullableInt(o.inventory_remaining, 0, MAX_INVENTORY),
    low_stock: asBool(o.low_stock),
    last_one: asBool(o.last_one),
  };

  const flags = deriveStockFlags(flagsRaw);

  const data: IncomingCartIntelligenceEvent = {
    event_name: o.event_name,
    session_id,
    cart_token: nullableStr(o.cart_token, MAX.token),
    checkout_token: nullableStr(o.checkout_token, MAX.token),
    product_id: nullableStr(o.product_id, MAX.productId),
    variant_id: nullableStr(o.variant_id, MAX.productId),
    product_title: nullableStr(o.product_title, MAX.productTitle),
    variant_title: nullableStr(o.variant_title, MAX.variantTitle),
    quantity: nullableInt(o.quantity, 0, MAX_QUANTITY),
    inventory_remaining: flagsRaw.inventory_remaining,
    low_stock: flags.low_stock,
    last_one: flags.last_one,
    cart_value: nullableFiniteNumber(o.cart_value, 0, MAX_CART_VALUE),
    currency: nullableStr(o.currency, MAX.currency),
    source: clampStr(o.source ?? "shopify_pixel", MAX.source) || "shopify_pixel",
    client_timestamp: parseClientTimestamp(o.timestamp),
  };

  return { ok: true, data };
}

/**
 * Salted SHA-256 of the client IP. We never store the raw IP — the salt comes
 * from `CART_INTELLIGENCE_IP_SALT` (set this in production for stable hashes
 * across restarts; falls back to `MONGODB_URI` so dev environments still work).
 */
export function hashClientIp(ip: string | null | undefined): string | null {
  const trimmed = String(ip ?? "").trim();
  if (!trimmed) return null;
  const salt =
    process.env.CART_INTELLIGENCE_IP_SALT?.trim() ||
    process.env.MONGODB_URI?.trim() ||
    "kokobay-cart-intelligence";
  return createHash("sha256").update(`${salt}::${trimmed}`).digest("hex");
}

/**
 * Returns every event in `[from, to]` (inclusive) sorted oldest → newest.
 * Excludes PII (`ip_hash`, `user_agent`) so the result is safe to log to
 * stdout in development. Used by the report route's debug dump and any
 * future internal triage tooling.
 */
export async function listCartIntelligenceEvents(input: {
  from: Date | null;
  to: Date | null;
  limit?: number;
}): Promise<CartIntelligenceEventDoc[]> {
  await ensureCartIntelligenceIndexes();
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection<CartIntelligenceEventDoc>(CART_INTELLIGENCE_EVENTS_COLLECTION);

  const filter: Filter<CartIntelligenceEventDoc> = {};
  if (input.from || input.to) {
    const range: { $gte?: Date; $lte?: Date } = {};
    if (input.from) range.$gte = input.from;
    if (input.to) range.$lte = input.to;
    filter.created_at = range;
  }

  const cursor = col
    .find(filter, { projection: { ip_hash: 0, user_agent: 0 } })
    .sort({ created_at: 1 });
  if (input.limit && input.limit > 0) cursor.limit(input.limit);
  return cursor.toArray();
}

let indexesEnsured: Promise<void> | null = null;

async function ensureCartIntelligenceIndexes(): Promise<void> {
  if (!indexesEnsured) {
    indexesEnsured = (async () => {
      const client = await clientPromise;
      const col = client
        .db(kokobayDbName)
        .collection<CartIntelligenceEventDoc>(
          CART_INTELLIGENCE_EVENTS_COLLECTION,
        );
      await Promise.all([
        col.createIndex({ event_name: 1, created_at: -1 }),
        col.createIndex({ stock_bucket: 1, event_name: 1, created_at: -1 }),
        col.createIndex({ session_id: 1, created_at: -1 }),
        col.createIndex({ cart_token: 1, created_at: -1 }),
        col.createIndex({ checkout_token: 1, created_at: -1 }),
        col.createIndex({ created_at: -1 }),
      ]);
    })().catch((e) => {
      // Reset so a future call may retry.
      indexesEnsured = null;
      throw e;
    });
  }
  return indexesEnsured;
}

export interface ServerEnrichmentResult {
  data: IncomingCartIntelligenceEvent;
  inventory_source: CartIntelligenceInventorySource;
  /** Raw lookup result, kept for the route handler to log on failure. */
  lookup: VariantInventoryLookupResult | null;
}

/**
 * Server-side enrichment: takes the validated pixel payload and replaces
 * `inventory_remaining` (plus the derived `low_stock` / `last_one` flags)
 * with a fresh value from the Shopify Admin API.
 *
 * - Variant id can be numeric or a Storefront/Admin GID.
 * - On any Shopify error/timeout we keep whatever the pixel sent and tag
 *   the row with `inventory_source: "shopify_admin_error"`. We never drop
 *   the event because of an enrichment failure.
 *
 * This is the single source of truth for stock bucketing: the pixel is
 * intentionally dumb so we can change the rules in one place.
 */
export async function enrichEventWithShopifyInventory(
  data: IncomingCartIntelligenceEvent,
  options?: { timeoutMs?: number },
): Promise<ServerEnrichmentResult> {
  const lookup = data.variant_id
    ? await fetchShopifyVariantInventory(data.variant_id, options)
    : null;

  if (lookup && lookup.ok) {
    const inv = lookup.inventoryQuantity;
    const flags = deriveStockFlags({
      inventory_remaining: inv,
      // Force-recompute from the freshly-fetched inventory.
      low_stock: false,
      last_one: false,
    });
    const enriched: IncomingCartIntelligenceEvent = {
      ...data,
      inventory_remaining: inv,
      low_stock: flags.low_stock,
      last_one: flags.last_one,
      // Backfill product / variant titles & ids when the pixel didn’t supply them.
      product_id:
        data.product_id ??
        (lookup.productId != null ? String(lookup.productId) : null),
      variant_title: data.variant_title ?? lookup.variantTitle,
    };
    return {
      data: enriched,
      inventory_source: lookup.cached ? "shopify_admin_cached" : "shopify_admin",
      lookup,
    };
  }

  // No usable variant id, Shopify not configured, 404, timeout, etc.
  if (lookup == null) {
    // No variant id sent at all. Keep whatever the pixel hinted.
    if (data.inventory_remaining != null) {
      return {
        data,
        inventory_source: "pixel_hint",
        lookup: null,
      };
    }
    return {
      data,
      inventory_source: "missing",
      lookup: null,
    };
  }

  // Shopify call attempted but failed — fall back to the pixel’s hint.
  if (data.inventory_remaining != null) {
    return {
      data,
      inventory_source: "shopify_admin_error",
      lookup,
    };
  }
  // Nothing to bucket on; mark as missing so we know it was unenriched.
  return {
    data: { ...data, low_stock: false, last_one: false },
    inventory_source: "shopify_admin_error",
    lookup,
  };
}

/**
 * Inserts a validated (and ideally Shopify-enriched) pixel event into Mongo.
 * Caller is expected to have already passed the body through
 * {@link validateCartIntelligenceEvent} and {@link enrichEventWithShopifyInventory}.
 */
export async function insertCartIntelligenceEvent(
  data: IncomingCartIntelligenceEvent,
  meta: {
    user_agent: string | null;
    ip_hash: string | null;
    inventory_source: CartIntelligenceInventorySource;
  },
): Promise<void> {
  await ensureCartIntelligenceIndexes();
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection<CartIntelligenceEventDoc>(CART_INTELLIGENCE_EVENTS_COLLECTION);

  const bucket = stockBucketFromFlags({
    low_stock: data.low_stock,
    last_one: data.last_one,
  });

  const now = new Date();
  // Prefer the client timestamp when sane; the validator already clamped it.
  const created_at = data.client_timestamp ?? now;

  const doc: CartIntelligenceEventDoc = {
    event_name: data.event_name,
    session_id: data.session_id,
    cart_token: data.cart_token,
    checkout_token: data.checkout_token,
    product_id: data.product_id,
    variant_id: data.variant_id,
    product_title: data.product_title,
    variant_title: data.variant_title,
    quantity: data.quantity,
    inventory_remaining: data.inventory_remaining,
    low_stock: data.low_stock,
    last_one: data.last_one,
    stock_bucket: bucket,
    cart_value: data.cart_value,
    currency: data.currency,
    source: data.source,
    user_agent: meta.user_agent,
    ip_hash: meta.ip_hash,
    inventory_source: meta.inventory_source,
    created_at,
  };

  await col.insertOne(doc);
}

export interface CartIntelligenceBucketReport {
  add_to_cart_count: number;
  checkout_started_count: number;
  checkout_completed_count: number;
  abandonment_rate: number;
}

export interface CartIntelligenceReport {
  date_range: {
    /** Inclusive ISO start (UTC). `null` means earliest event. */
    from: string | null;
    /** Inclusive ISO end (UTC). `null` means now. */
    to: string | null;
  };
  /** Distinct session_ids in the report window. */
  total_sessions: number;
  /** Raw pixel event count in the report window. */
  total_events: number;
  low_stock: CartIntelligenceBucketReport;
  last_one: CartIntelligenceBucketReport;
  normal: CartIntelligenceBucketReport;
  /** Aggregate across all three buckets. */
  overall: CartIntelligenceBucketReport;
}

function abandonmentRate(
  add: number,
  completed: number,
): number {
  if (add <= 0) return 0;
  const pct = ((add - completed) / add) * 100;
  // Clamp to [0, 100] in case of weird overcounting.
  return Math.max(0, Math.min(100, Math.round(pct * 100) / 100));
}

function emptyBucketReport(): CartIntelligenceBucketReport {
  return {
    add_to_cart_count: 0,
    checkout_started_count: 0,
    checkout_completed_count: 0,
    abandonment_rate: 0,
  };
}

/**
 * Aggregates events into cohort-level counts using **session-level cohort
 * assignment**:
 *
 *   1. Group by `session_id` and collect every `stock_bucket` and
 *      `event_name` the session ever touched.
 *   2. Pin a single cohort to the session: `last_one` wins over `low_stock`,
 *      which wins over `normal`. This way a shopper who added a last-one
 *      item still counts as a last-one session even if their
 *      `checkout_completed` event arrived without a variant id (Shopify’s
 *      pixel sometimes omits line items at completion).
 *   3. For each cohort, count the number of sessions that fired each event
 *      type. A session with both `product_added_to_cart` and
 *      `checkout_completed` cleanly lands in *both* counts under the same
 *      cohort, so the abandonment ratio reflects shoppers, not events.
 *
 * `cart_token` / `checkout_token` are stored alongside `session_id` so a
 * future improvement can join across devices once Shopify exposes a stable
 * customer id at all stages.
 */
export async function getCartIntelligenceReport(input: {
  from: Date | null;
  to: Date | null;
}): Promise<CartIntelligenceReport> {
  await ensureCartIntelligenceIndexes();
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection<CartIntelligenceEventDoc>(CART_INTELLIGENCE_EVENTS_COLLECTION);

  const match: Filter<CartIntelligenceEventDoc> = {};
  if (input.from || input.to) {
    const range: { $gte?: Date; $lte?: Date } = {};
    if (input.from) range.$gte = input.from;
    if (input.to) range.$lte = input.to;
    match.created_at = range;
  }

  type AggRow = {
    _id: CartIntelligenceStockBucket;
    /** Distinct sessions pinned to this dominant cohort. */
    session_count: number;
    add_to_cart_count: number;
    checkout_started_count: number;
    checkout_completed_count: number;
  };

  const pipeline: Document[] = [
    { $match: match },
    {
      // Roll every session up into its set of buckets touched and event types fired.
      $group: {
        _id: "$session_id",
        buckets: { $addToSet: "$stock_bucket" },
        events: { $addToSet: "$event_name" },
      },
    },
    {
      // Pin one cohort per session: last_one > low_stock > normal.
      $project: {
        session_cohort: {
          $cond: [
            { $in: ["last_one", "$buckets"] },
            "last_one",
            {
              $cond: [
                { $in: ["low_stock", "$buckets"] },
                "low_stock",
                "normal",
              ],
            },
          ],
        },
        has_add: { $in: ["product_added_to_cart", "$events"] },
        has_started: { $in: ["checkout_started", "$events"] },
        has_completed: { $in: ["checkout_completed", "$events"] },
      },
    },
    {
      $group: {
        _id: "$session_cohort",
        session_count: { $sum: 1 },
        add_to_cart_count: { $sum: { $cond: ["$has_add", 1, 0] } },
        checkout_started_count: {
          $sum: { $cond: ["$has_started", 1, 0] },
        },
        checkout_completed_count: {
          $sum: { $cond: ["$has_completed", 1, 0] },
        },
      },
    },
  ];

  const rows = (await col.aggregate<AggRow>(pipeline).toArray()) as AggRow[];

  const buckets: Record<CartIntelligenceStockBucket, CartIntelligenceBucketReport> = {
    low_stock: emptyBucketReport(),
    last_one: emptyBucketReport(),
    normal: emptyBucketReport(),
  };
  const overall = emptyBucketReport();
  let total_sessions = 0;

  for (const r of rows) {
    const bucket = buckets[r._id];
    if (!bucket) continue;
    total_sessions += r.session_count;
    bucket.add_to_cart_count = r.add_to_cart_count;
    bucket.checkout_started_count = r.checkout_started_count;
    bucket.checkout_completed_count = r.checkout_completed_count;
    overall.add_to_cart_count += r.add_to_cart_count;
    overall.checkout_started_count += r.checkout_started_count;
    overall.checkout_completed_count += r.checkout_completed_count;
  }

  for (const k of CART_INTELLIGENCE_STOCK_BUCKETS) {
    buckets[k].abandonment_rate = abandonmentRate(
      buckets[k].add_to_cart_count,
      buckets[k].checkout_completed_count,
    );
  }
  overall.abandonment_rate = abandonmentRate(
    overall.add_to_cart_count,
    overall.checkout_completed_count,
  );

  // Cheap total-events count for the dashboard header.
  const total_events = await col.countDocuments(match);

  return {
    date_range: {
      from: input.from ? input.from.toISOString() : null,
      to: input.to ? input.to.toISOString() : null,
    },
    total_sessions,
    total_events,
    low_stock: buckets.low_stock,
    last_one: buckets.last_one,
    normal: buckets.normal,
    overall,
  };
}

/**
 * Clamps `?from=…&to=…` query params to a sane window. Both are optional —
 * default range is the last 30 days when `from` is not given.
 */
export function parseReportRange(sp: URLSearchParams): {
  from: Date | null;
  to: Date | null;
} {
  const fromStr = sp.get("from")?.trim() ?? "";
  const toStr = sp.get("to")?.trim() ?? "";
  let from: Date | null = null;
  let to: Date | null = null;

  if (fromStr) {
    const d = new Date(fromStr);
    if (!Number.isNaN(d.getTime())) from = d;
  }
  if (toStr) {
    const d = new Date(toStr);
    if (!Number.isNaN(d.getTime())) to = d;
  }
  if (from == null && to == null) {
    // Default: last 30 days.
    to = new Date();
    from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return { from, to };
}
