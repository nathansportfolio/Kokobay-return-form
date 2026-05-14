import type { Document } from "mongodb";
import clientPromise, { kokobayDbName } from "@/lib/mongodb";
import { PRODUCT_STOCK_LOOKUPS_COLLECTION } from "@/lib/productStockLookupLog";
import {
  WAREHOUSE_TZ,
  calendarDateKeyWithOffsetInTz,
  getTodayCalendarDateKeyInLondon,
  getWarehouseDayCreatedAtQueryBoundsUtc,
} from "@/lib/warehouseLondonDay";

export type StockExposureRange = "today" | "yesterday" | "7d" | "30d" | "all";

export type StockExposureTotals = {
  totalViews: number;
  outOfStockViews: number;
  lowStockViews: number;
  healthyViews: number;
};

export type StockExposurePercentages = {
  outOfStockRate: number;
  lowStockRate: number;
  healthyRate: number;
};

export type StockExposureBySourceRow = {
  source: string;
  totalViews: number;
  outOfStockViews: number;
  lowStockViews: number;
  healthyViews: number;
  outOfStockRate: number;
  lowStockRate: number;
  healthyRate: number;
};

export type StockExposureTopOosProduct = {
  handle: string;
  title: string;
  views: number;
  totalStock: number;
  sourceBreakdown: { source: string; views: number }[];
};

export type StockExposureTopLowProduct = {
  handle: string;
  title: string;
  totalStock: number;
  views: number;
};

export type StockExposureDailyTrendRow = {
  day: string;
  outOfStockViews: number;
  lowStockViews: number;
  healthyViews: number;
};

export type StockExposureAnalytics = {
  range: StockExposureRange;
  totals: StockExposureTotals;
  percentages: StockExposurePercentages;
  bySource: StockExposureBySourceRow[];
  topOutOfStockProducts: StockExposureTopOosProduct[];
  topLowStockProducts: StockExposureTopLowProduct[];
  dailyTrend: StockExposureDailyTrendRow[];
};

let indexesEnsured = false;

async function ensureStockExposureLookupIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection(PRODUCT_STOCK_LOOKUPS_COLLECTION);
  await col.createIndex({ createdAt: -1 });
  await col.createIndex({ utmSource: 1 });
  await col.createIndex({ handle: 1 });
  indexesEnsured = true;
}

export function parseStockExposureRange(raw: string | undefined): StockExposureRange {
  const s = String(raw ?? "").trim();
  if (
    s === "today" ||
    s === "yesterday" ||
    s === "7d" ||
    s === "30d" ||
    s === "all"
  ) {
    return s;
  }
  return "7d";
}

/** Inclusive London calendar bounds as UTC `Date` for filtering `createdAt`. */
function getCreatedAtBoundsUtc(
  range: StockExposureRange,
): { from: Date; to: Date } | null {
  if (range === "all") return null;
  const tz = WAREHOUSE_TZ;
  if (range === "today") {
    const key = getTodayCalendarDateKeyInLondon();
    const { createdAtMin, createdAtMax } =
      getWarehouseDayCreatedAtQueryBoundsUtc(key);
    return { from: new Date(createdAtMin), to: new Date(createdAtMax) };
  }
  if (range === "yesterday") {
    const key = calendarDateKeyWithOffsetInTz(tz, -1);
    const { createdAtMin, createdAtMax } =
      getWarehouseDayCreatedAtQueryBoundsUtc(key);
    return { from: new Date(createdAtMin), to: new Date(createdAtMax) };
  }
  const daysBack = range === "7d" ? 6 : 29;
  const startKey = calendarDateKeyWithOffsetInTz(tz, -daysBack);
  const endKey = getTodayCalendarDateKeyInLondon();
  const { createdAtMin } = getWarehouseDayCreatedAtQueryBoundsUtc(startKey);
  const { createdAtMax } = getWarehouseDayCreatedAtQueryBoundsUtc(endKey);
  return { from: new Date(createdAtMin), to: new Date(createdAtMax) };
}

const withComputedFields: Document[] = [
  {
    $addFields: {
      totalStock: {
        $reduce: {
          input: { $ifNull: ["$variants", []] },
          initialValue: 0,
          in: {
            $add: ["$$value", { $ifNull: ["$$this.inventory", 0] }],
          },
        },
      },
    },
  },
  {
    $addFields: {
      stockBucket: {
        $switch: {
          branches: [
            { case: { $lte: ["$totalStock", 0] }, then: "out_of_stock" },
            { case: { $lt: ["$totalStock", 10] }, then: "low_stock" },
          ],
          default: "healthy",
        },
      },
      source: {
        $cond: [
          {
            $or: [
              { $eq: ["$utmSource", null] },
              {
                $eq: [
                  {
                    $strLenCP: {
                      $trim: { input: { $ifNull: ["$utmSource", ""] } },
                    },
                  },
                  0,
                ],
              },
            ],
          },
          "non_landing_page",
          { $trim: { input: "$utmSource" } },
        ],
      },
    },
  },
];

function emptyAnalytics(range: StockExposureRange): StockExposureAnalytics {
  return {
    range,
    totals: {
      totalViews: 0,
      outOfStockViews: 0,
      lowStockViews: 0,
      healthyViews: 0,
    },
    percentages: { outOfStockRate: 0, lowStockRate: 0, healthyRate: 0 },
    bySource: [],
    topOutOfStockProducts: [],
    topLowStockProducts: [],
    dailyTrend: [],
  };
}

function pct(part: number, whole: number): number {
  if (whole <= 0 || !Number.isFinite(part)) return 0;
  return Math.round((part * 1000) / whole) / 10;
}

/**
 * Page exposure analytics from Mongo **`productStockLookups`**: each document = one view.
 * Date filters use **Europe/London** calendar days (same helpers as warehouse day bounds).
 */
export async function getStockExposureAnalytics(
  rangeInput: string | undefined,
): Promise<StockExposureAnalytics> {
  await ensureStockExposureLookupIndexes();
  const range = parseStockExposureRange(rangeInput);
  const bounds = getCreatedAtBoundsUtc(range);

  const client = await clientPromise;
  const col = client
    .db(kokobayDbName)
    .collection(PRODUCT_STOCK_LOOKUPS_COLLECTION);

  const matchStage: Document | null =
    bounds == null
      ? null
      : { $match: { createdAt: { $gte: bounds.from, $lte: bounds.to } } };

  const prefix: Document[] = matchStage ? [matchStage, ...withComputedFields] : [...withComputedFields];

  const [facetRow] = await col
    .aggregate<{
      summary: {
        totalViews: number;
        outOfStockViews: number;
        lowStockViews: number;
        healthyViews: number;
      }[];
      bySource: {
        _id: string;
        totalViews: number;
        outOfStockViews: number;
        lowStockViews: number;
        healthyViews: number;
      }[];
      daily: {
        _id: string;
        outOfStockViews: number;
        lowStockViews: number;
        healthyViews: number;
      }[];
      topOos: {
        _id: string;
        title: string;
        views: number;
        totalStock: number;
        sourceBreakdown: { source: string; views: number }[];
      }[];
      topLow: {
        _id: string;
        title: string;
        views: number;
        totalStock: number;
      }[];
    }>([
      ...prefix,
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalViews: { $sum: 1 },
                outOfStockViews: {
                  $sum: {
                    $cond: [{ $eq: ["$stockBucket", "out_of_stock"] }, 1, 0],
                  },
                },
                lowStockViews: {
                  $sum: {
                    $cond: [{ $eq: ["$stockBucket", "low_stock"] }, 1, 0],
                  },
                },
                healthyViews: {
                  $sum: {
                    $cond: [{ $eq: ["$stockBucket", "healthy"] }, 1, 0],
                  },
                },
              },
            },
          ],
          bySource: [
            {
              $group: {
                _id: "$source",
                totalViews: { $sum: 1 },
                outOfStockViews: {
                  $sum: {
                    $cond: [{ $eq: ["$stockBucket", "out_of_stock"] }, 1, 0],
                  },
                },
                lowStockViews: {
                  $sum: {
                    $cond: [{ $eq: ["$stockBucket", "low_stock"] }, 1, 0],
                  },
                },
                healthyViews: {
                  $sum: {
                    $cond: [{ $eq: ["$stockBucket", "healthy"] }, 1, 0],
                  },
                },
              },
            },
            {
              $addFields: {
                outOfStockRate: {
                  $cond: [
                    { $gt: ["$totalViews", 0] },
                    {
                      $round: [
                        {
                          $multiply: [
                            { $divide: ["$outOfStockViews", "$totalViews"] },
                            1000,
                          ],
                        },
                        0,
                      ],
                    },
                    0,
                  ],
                },
                lowStockRate: {
                  $cond: [
                    { $gt: ["$totalViews", 0] },
                    {
                      $round: [
                        {
                          $multiply: [
                            { $divide: ["$lowStockViews", "$totalViews"] },
                            1000,
                          ],
                        },
                        0,
                      ],
                    },
                    0,
                  ],
                },
                healthyRate: {
                  $cond: [
                    { $gt: ["$totalViews", 0] },
                    {
                      $round: [
                        {
                          $multiply: [
                            { $divide: ["$healthyViews", "$totalViews"] },
                            1000,
                          ],
                        },
                        0,
                      ],
                    },
                    0,
                  ],
                },
              },
            },
            {
              $addFields: {
                healthyRate: { $divide: ["$healthyRate", 1000] },
                outOfStockRate: { $divide: ["$outOfStockRate", 1000] },
                lowStockRate: { $divide: ["$lowStockRate", 1000] },
              },
            },
            { $sort: { outOfStockRate: -1, outOfStockViews: -1, totalViews: -1 } },
            { $limit: 80 },
          ],
          daily: [
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$createdAt",
                    timezone: WAREHOUSE_TZ,
                  },
                },
                outOfStockViews: {
                  $sum: {
                    $cond: [{ $eq: ["$stockBucket", "out_of_stock"] }, 1, 0],
                  },
                },
                lowStockViews: {
                  $sum: {
                    $cond: [{ $eq: ["$stockBucket", "low_stock"] }, 1, 0],
                  },
                },
                healthyViews: {
                  $sum: {
                    $cond: [{ $eq: ["$stockBucket", "healthy"] }, 1, 0],
                  },
                },
              },
            },
            { $sort: { _id: 1 } },
          ],
          topOos: [
            { $match: { stockBucket: "out_of_stock" } },
            {
              $group: {
                _id: { handle: "$handle", source: "$source" },
                views: { $sum: 1 },
                title: { $first: "$productTitle" },
                totalStock: { $first: "$totalStock" },
              },
            },
            {
              $group: {
                _id: "$_id.handle",
                views: { $sum: "$views" },
                title: { $first: "$title" },
                totalStock: { $first: "$totalStock" },
                sourceBreakdown: {
                  $push: { source: "$_id.source", views: "$views" },
                },
              },
            },
            { $sort: { views: -1 } },
            { $limit: 20 },
          ],
          topLow: [
            { $match: { stockBucket: "low_stock" } },
            {
              $group: {
                _id: "$handle",
                views: { $sum: 1 },
                title: { $first: "$productTitle" },
                totalStock: { $first: "$totalStock" },
              },
            },
            { $sort: { views: -1 } },
            { $limit: 20 },
          ],
        },
      },
    ])
    .toArray();

  const bucket = facetRow ?? {};
  const s = bucket.summary?.[0];
  const totalViews = Math.max(0, Math.trunc(Number(s?.totalViews ?? 0)));
  const outOfStockViews = Math.max(
    0,
    Math.trunc(Number(s?.outOfStockViews ?? 0)),
  );
  const lowStockViews = Math.max(0, Math.trunc(Number(s?.lowStockViews ?? 0)));
  const healthyViews = Math.max(0, Math.trunc(Number(s?.healthyViews ?? 0)));

  if (totalViews === 0) {
    return { ...emptyAnalytics(range), range };
  }

  const bySource: StockExposureBySourceRow[] = (bucket.bySource ?? []).map(
    (r) => {
      const tv = Math.max(0, Math.trunc(Number(r.totalViews ?? 0)));
      const o = Math.max(0, Math.trunc(Number(r.outOfStockViews ?? 0)));
      const l = Math.max(0, Math.trunc(Number(r.lowStockViews ?? 0)));
      const h = Math.max(0, Math.trunc(Number(r.healthyViews ?? 0)));
      return {
        source: String(r._id ?? "non_landing_page"),
        totalViews: tv,
        outOfStockViews: o,
        lowStockViews: l,
        healthyViews: h,
        outOfStockRate: pct(o, tv),
        lowStockRate: pct(l, tv),
        healthyRate: pct(h, tv),
      };
    },
  );

  const dailyTrend: StockExposureDailyTrendRow[] = (bucket.daily ?? []).map(
    (d) => ({
      day: String(d._id ?? ""),
      outOfStockViews: Math.max(
        0,
        Math.trunc(Number(d.outOfStockViews ?? 0)),
      ),
      lowStockViews: Math.max(0, Math.trunc(Number(d.lowStockViews ?? 0))),
      healthyViews: Math.max(0, Math.trunc(Number(d.healthyViews ?? 0))),
    }),
  );

  const topOutOfStockProducts: StockExposureTopOosProduct[] = (
    bucket.topOos ?? []
  ).map((r) => {
    const breakdown = Array.isArray(r.sourceBreakdown)
      ? r.sourceBreakdown.map((x) => ({
          source: String(x.source ?? ""),
          views: Math.max(0, Math.trunc(Number(x.views ?? 0))),
        }))
      : [];
    breakdown.sort((a, b) => b.views - a.views);
    return {
      handle: String(r._id ?? ""),
      title: String(r.title ?? "").trim() || String(r._id ?? ""),
      views: Math.max(0, Math.trunc(Number(r.views ?? 0))),
      totalStock: Math.trunc(Number(r.totalStock ?? 0)),
      sourceBreakdown: breakdown,
    };
  });

  const topLowStockProducts: StockExposureTopLowProduct[] = (
    bucket.topLow ?? []
  ).map((r) => ({
    handle: String(r._id ?? ""),
    title: String(r.title ?? "").trim() || String(r._id ?? ""),
    totalStock: Math.round(Number(r.totalStock ?? 0) * 100) / 100,
    views: Math.max(0, Math.trunc(Number(r.views ?? 0))),
  }));

  return {
    range,
    totals: {
      totalViews,
      outOfStockViews,
      lowStockViews,
      healthyViews,
    },
    percentages: {
      outOfStockRate: pct(outOfStockViews, totalViews),
      lowStockRate: pct(lowStockViews, totalViews),
      healthyRate: pct(healthyViews, totalViews),
    },
    bySource,
    topOutOfStockProducts,
    topLowStockProducts,
    dailyTrend,
  };
}
