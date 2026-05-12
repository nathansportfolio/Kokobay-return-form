import { randomUUID } from "node:crypto";

export const KLAVIYO_EVENTS_URL = "https://a.klaviyo.com/api/events/";

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
 */
export async function postKlaviyoCreateEvent(
  input: KlaviyoCreateEventInput,
): Promise<
  | { ok: true; httpStatus: number; responseText: string }
  | { ok: false; httpStatus: number; responseText: string }
> {
  const { apiKey, metricName, properties, profile, logTag } = input;
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
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    accept: "application/json",
    "content-type": "application/json",
    revision: klaviyoApiRevision(),
  };
  const body = JSON.stringify(payload);

  console.log(
    `${logTag} Klaviyo request`,
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
    console.error(`${logTag} Klaviyo error`, res.status, responseText.slice(0, 2000));
    return { ok: false, httpStatus: res.status, responseText };
  }

  if (responseText.trim()) {
    console.log(`${logTag} Klaviyo response body`, responseText.slice(0, 1500));
  }

  return { ok: true, httpStatus: res.status, responseText };
}
