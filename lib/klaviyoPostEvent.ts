import { createHash, randomUUID } from "node:crypto";

export const KLAVIYO_EVENTS_URL = "https://a.klaviyo.com/api/events/";

function sha256Prefix12(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex").slice(0, 12);
}

function profileEmailHint(email: string): string {
  const t = String(email ?? "").trim();
  const at = t.indexOf("@");
  if (at <= 0) return "(none)";
  return `${t.slice(0, 2)}…@${t.slice(at + 1)}`;
}

function shouldLogFullKlaviyoRequest(): boolean {
  if (process.env.KLAVIYO_DEBUG_FULL_REQUEST?.trim() === "1") return true;
  return process.env.NODE_ENV === "development";
}

/** Klaviyo `revision` header; override if Klaviyo deprecates older revisions. */
export function klaviyoApiRevision(): string {
  return process.env.KLAVIYO_API_REVISION?.trim() || "2024-10-15";
}

export type KlaviyoCreateEventInput = {
  apiKey: string;
  metricName: string;
  /** Event properties (Klaviyo `attributes.properties`). */
  properties: Record<string, unknown>;
  profile: { email: string; first_name: string };
  /** Log tag for console, e.g. `[klaviyo/return-rejected]`. */
  logTag: string;
};

/**
 * POST Create Event — shared fetch + headers.
 * Sets `time` and `unique_id` so events are not dropped by Klaviyo’s
 * “one event per profile + metric per second” default deduping.
 *
 * Logging: always logs a **summary** (env, revision, `apiKeySha256Prefix12`, etc.).
 * Full JSON body logs when `NODE_ENV === "development"` or `KLAVIYO_DEBUG_FULL_REQUEST=1`.
 */
export async function postKlaviyoCreateEvent(
  input: KlaviyoCreateEventInput,
): Promise<
  | { ok: true; httpStatus: number; responseText: string }
  | { ok: false; httpStatus: number; responseText: string }
> {
  const { apiKey, metricName, properties, profile, logTag } = input;
  const key = String(apiKey ?? "").trim();
  if (!key) {
    console.error(`${logTag} empty Klaviyo API key`);
    return { ok: false, httpStatus: 0, responseText: "Missing Klaviyo API key" };
  }

  const time = new Date().toISOString();
  const unique_id = randomUUID();

  const payload = {
    data: {
      type: "event",
      attributes: {
        properties,
        time,
        unique_id,
        metric: {
          data: {
            type: "metric",
            attributes: {
              name: metricName,
            },
          },
        },
        profile: {
          data: {
            type: "profile",
            attributes: {
              email: profile.email,
              first_name: profile.first_name,
            },
          },
        },
      },
    },
  };

  const headers = {
    Authorization: `Klaviyo-API-Key ${key}`,
    accept: "application/vnd.api+json",
    "content-type": "application/vnd.api+json",
    revision: klaviyoApiRevision(),
  };
  const body = JSON.stringify(payload);

  const summary = {
    nodeEnv: process.env.NODE_ENV ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    vercelUrl: process.env.VERCEL_URL ?? null,
    revision: headers.revision,
    url: KLAVIYO_EVENTS_URL,
    metricName,
    unique_id,
    time,
    bodyUtf8Bytes: Buffer.byteLength(body, "utf8"),
    profileEmailHint: profileEmailHint(profile.email),
    apiKeyUtf8Bytes: Buffer.byteLength(key, "utf8"),
    apiKeySha256Prefix12: sha256Prefix12(key),
  };
  console.log(`${logTag} Klaviyo outbound (summary)`, summary);

  if (shouldLogFullKlaviyoRequest()) {
    console.log(
      `${logTag} Klaviyo outbound (full body — dev or KLAVIYO_DEBUG_FULL_REQUEST=1)`,
      JSON.stringify(
        {
          url: KLAVIYO_EVENTS_URL,
          method: "POST",
          headers: {
            ...headers,
            Authorization: "Klaviyo-API-Key <redacted>",
          },
          body: payload,
        },
        null,
        2,
      ),
    );
  }

  let res: Response;
  try {
    res = await fetch(KLAVIYO_EVENTS_URL, {
      method: "POST",
      headers,
      body,
    });
  } catch (e) {
    console.error(`${logTag} fetch failed`, e);
    return { ok: false, httpStatus: 0, responseText: String(e) };
  }

  const responseText = await res.text().catch(() => "");

  if (!res.ok) {
    console.error(`${logTag} Klaviyo response (error)`, {
      httpStatus: res.status,
      responseUtf8Bytes: Buffer.byteLength(responseText, "utf8"),
      bodyPreview: responseText.slice(0, 2000),
    });
    return { ok: false, httpStatus: res.status, responseText };
  }

  console.log(`${logTag} Klaviyo response (ok)`, {
    httpStatus: res.status,
    responseUtf8Bytes: Buffer.byteLength(responseText, "utf8"),
    ...(responseText.trim()
      ? { bodyPreview: responseText.slice(0, 1500) }
      : { bodyPreview: "(empty)" }),
  });

  return { ok: true, httpStatus: res.status, responseText };
}
