import {
  buildDigest,
  deliveryKey,
  digestKeyFor,
  dueNotifications,
  isDigestDue,
  localTime,
  toPushPayload,
} from "./delivery.js";
import { sendPush } from "./push.js";
import type {
  PushSubscriptionJSON,
  SchedulePayload,
  SentLog,
  StoredDevice,
} from "./types.js";

export interface Env {
  KV: KVNamespace;
  VAPID_PUBLIC_KEY: string;
  /** ECDSA P-256 private key as a JWK string. */
  VAPID_PRIVATE_JWK: string;
  VAPID_SUBJECT: string;
  ALLOWED_ORIGINS?: string;
}

/** Keeps one runaway device from exhausting the KV value size limit. */
const MAX_NOTIFICATIONS = 500;
const SENT_LOG_TTL_SECONDS = 60 * 60 * 24 * 3;

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = (env.ALLOWED_ORIGINS ?? "*")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const allowOrigin =
    allowed.includes("*") || (origin && allowed.includes(origin))
      ? origin || "*"
      : (allowed[0] ?? "");

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(
  data: unknown,
  status = 200,
  cors: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function deviceKey(deviceId: string): string {
  return `device:${deviceId}`;
}

function sentKey(deviceId: string): string {
  return `sent:${deviceId}`;
}

function emptySchedule(deviceId: string): SchedulePayload {
  return {
    deviceId,
    digestEnabled: false,
    digestTime: "08:00",
    notifications: [],
  };
}

function normalizeSchedule(input: SchedulePayload): SchedulePayload {
  return {
    ...input,
    notifications: (input.notifications ?? []).slice(0, MAX_NOTIFICATIONS),
  };
}

async function readSentLog(env: Env, deviceId: string): Promise<SentLog> {
  return (await env.KV.get<SentLog>(sentKey(deviceId), "json")) ?? {};
}

async function writeSentLog(
  env: Env,
  deviceId: string,
  sent: SentLog,
): Promise<void> {
  await env.KV.put(sentKey(deviceId), JSON.stringify(sent), {
    expirationTtl: SENT_LOG_TTL_SECONDS,
  });
}

async function dropDevice(env: Env, deviceId: string): Promise<void> {
  await env.KV.delete(deviceKey(deviceId));
  await env.KV.delete(sentKey(deviceId));
}

function pushOptions(env: Env) {
  return { privateJWK: env.VAPID_PRIVATE_JWK, subject: env.VAPID_SUBJECT };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === "/health") {
        return json(
          {
            ok: true,
            configured: Boolean(env.VAPID_PRIVATE_JWK && env.VAPID_PUBLIC_KEY),
            time: new Date().toISOString(),
          },
          200,
          cors,
        );
      }

      if (url.pathname === "/vapid-public-key" && request.method === "GET") {
        return json({ publicKey: env.VAPID_PUBLIC_KEY }, 200, cors);
      }

      if (url.pathname === "/subscribe" && request.method === "POST") {
        const { deviceId, subscription } = (await request.json()) as {
          deviceId?: string;
          subscription?: PushSubscriptionJSON;
        };
        if (!deviceId || !subscription?.endpoint) {
          return json({ ok: false, error: "Bad request" }, 400, cors);
        }

        const existing = await env.KV.get<StoredDevice>(
          deviceKey(deviceId),
          "json",
        );
        await env.KV.put(
          deviceKey(deviceId),
          JSON.stringify({
            subscription,
            schedule: existing?.schedule ?? emptySchedule(deviceId),
          } satisfies StoredDevice),
        );
        return json({ ok: true }, 200, cors);
      }

      if (url.pathname === "/schedule" && request.method === "POST") {
        const payload = (await request.json()) as SchedulePayload;
        if (!payload?.deviceId) {
          return json({ ok: false, error: "Bad request" }, 400, cors);
        }

        const existing = await env.KV.get<StoredDevice>(
          deviceKey(payload.deviceId),
          "json",
        );
        if (!existing?.subscription) {
          return json({ ok: false, error: "No subscription" }, 400, cors);
        }

        await env.KV.put(
          deviceKey(payload.deviceId),
          JSON.stringify({
            subscription: existing.subscription,
            schedule: normalizeSchedule(payload),
          } satisfies StoredDevice),
        );
        return json(
          { ok: true, count: normalizeSchedule(payload).notifications.length },
          200,
          cors,
        );
      }

      if (url.pathname === "/unsubscribe" && request.method === "POST") {
        const { deviceId } = (await request.json()) as { deviceId?: string };
        if (deviceId) await dropDevice(env, deviceId);
        return json({ ok: true }, 200, cors);
      }

      // Lets the user prove delivery works without waiting for a real reminder.
      if (url.pathname === "/test" && request.method === "POST") {
        const { deviceId } = (await request.json()) as { deviceId?: string };
        if (!deviceId) {
          return json({ ok: false, error: "Bad request" }, 400, cors);
        }

        const stored = await env.KV.get<StoredDevice>(
          deviceKey(deviceId),
          "json",
        );
        if (!stored?.subscription) {
          return json({ ok: false, error: "No subscription" }, 400, cors);
        }

        const result = await sendPush(
          stored.subscription,
          {
            title: "Plotline reminders are on",
            body: "This is a test. Real reminders will arrive at their due time.",
            url: "/",
          },
          { ...pushOptions(env), ttlSeconds: 60 },
        );

        if (result.status === "expired") {
          await dropDevice(env, deviceId);
          return json(
            { ok: false, error: "Subscription expired. Re-enable to fix." },
            410,
            cors,
          );
        }
        if (result.status === "failed") {
          return json({ ok: false, error: result.detail }, 502, cors);
        }
        return json({ ok: true }, 200, cors);
      }

      return json({ error: "Not found" }, 404, cors);
    } catch (err) {
      return json(
        { error: err instanceof Error ? err.message : "Error" },
        500,
        cors,
      );
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const now = Date.now();
    let cursor: string | undefined;

    do {
      const list = await env.KV.list({ prefix: "device:", cursor });
      cursor = list.list_complete ? undefined : list.cursor;

      for (const key of list.keys) {
        await processDevice(env, key.name, now);
      }
    } while (cursor);
  },
};

async function processDevice(
  env: Env,
  key: string,
  now: number,
): Promise<void> {
  const stored = await env.KV.get<StoredDevice>(key, "json");
  if (!stored?.subscription || !stored.schedule) return;

  const { schedule, subscription } = stored;
  const deviceId = schedule.deviceId || key.slice("device:".length);
  const sent = await readSentLog(env, deviceId);
  let changed = false;

  for (const notification of dueNotifications(schedule, sent, now)) {
    const result = await sendPush(
      subscription,
      toPushPayload(notification),
      pushOptions(env),
    );

    if (result.status === "expired") {
      await dropDevice(env, deviceId);
      return;
    }
    if (result.status === "sent") {
      sent[deliveryKey(notification)] = new Date(now).toISOString();
      changed = true;
    } else {
      console.error(`push failed for ${deviceId}: ${result.detail}`);
    }
  }

  if (isDigestDue(schedule, sent, now)) {
    const result = await sendPush(
      subscription,
      buildDigest(schedule, now),
      pushOptions(env),
    );

    if (result.status === "expired") {
      await dropDevice(env, deviceId);
      return;
    }
    if (result.status === "sent") {
      sent[digestKeyFor(localTime(now, schedule.timeZone).date)] = new Date(
        now,
      ).toISOString();
      changed = true;
    } else {
      console.error(`digest failed for ${deviceId}: ${result.detail}`);
    }
  }

  if (changed) await writeSentLog(env, deviceId, sent);
}
