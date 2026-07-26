import webpush from "web-push";

export interface Env {
  KV: KVNamespace;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
}

interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface ScheduledNotification {
  id: string;
  fireAt: string;
  title: string;
  body: string;
}

interface SchedulePayload {
  deviceId: string;
  digestEnabled: boolean;
  digestTime: string;
  notifications: ScheduledNotification[];
}

interface StoredDevice {
  subscription: PushSubscriptionJSON;
  schedule: SchedulePayload;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === "/subscribe" && request.method === "POST") {
        const { deviceId, subscription } = (await request.json()) as {
          deviceId: string;
          subscription: PushSubscriptionJSON;
        };
        const existing = await env.KV.get<StoredDevice>(
          `device:${deviceId}`,
          "json",
        );
        await env.KV.put(
          `device:${deviceId}`,
          JSON.stringify({
            subscription,
            schedule: existing?.schedule ?? {
              deviceId,
              digestEnabled: false,
              digestTime: "08:00",
              notifications: [],
            },
          }),
        );
        return json({ ok: true });
      }

      if (url.pathname === "/schedule" && request.method === "POST") {
        const schedule = (await request.json()) as SchedulePayload;
        const existing = await env.KV.get<StoredDevice>(
          `device:${schedule.deviceId}`,
          "json",
        );
        if (!existing?.subscription) {
          return json({ ok: false, error: "No subscription" }, 400);
        }
        await env.KV.put(
          `device:${schedule.deviceId}`,
          JSON.stringify({ subscription: existing.subscription, schedule }),
        );
        return json({ ok: true });
      }

      if (url.pathname === "/vapid-public-key" && request.method === "GET") {
        return json({ publicKey: env.VAPID_PUBLIC_KEY });
      }

      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "Error" }, 500);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    webpush.setVapidDetails(
      env.VAPID_SUBJECT,
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY,
    );

    const now = Date.now();
    const list = await env.KV.list({ prefix: "device:" });

    for (const key of list.keys) {
      const stored = await env.KV.get<StoredDevice>(key.name, "json");
      if (!stored?.subscription) continue;

      const { schedule, subscription } = stored;
      const sentKey = `sent:${schedule.deviceId}`;
      const sentRaw = (await env.KV.get(sentKey, "json")) as Record<
        string,
        string
      > | null;
      const sent = sentRaw ?? {};

      // Item notifications
      for (const n of schedule.notifications) {
        const fire = new Date(n.fireAt).getTime();
        if (fire <= now && fire > now - 120000 && !sent[n.id]) {
          try {
            await webpush.sendNotification(
              subscription as webpush.PushSubscription,
              JSON.stringify({ title: n.title, body: n.body, url: "/" }),
            );
            sent[n.id] = new Date().toISOString();
          } catch (err) {
            console.error("Push failed", err);
          }
        }
      }

      // Daily digest
      if (schedule.digestEnabled) {
        const [hh, mm] = schedule.digestTime.split(":").map(Number);
        const d = new Date();
        const digestKey = `digest:${d.toISOString().slice(0, 10)}`;
        if (d.getHours() === hh && d.getMinutes() === mm && !sent[digestKey]) {
          const todayItems = schedule.notifications.filter((n) => {
            const fire = new Date(n.fireAt);
            return fire.toDateString() === d.toDateString();
          });
          const body =
            todayItems.length === 0
              ? "Nothing due today."
              : todayItems
                  .slice(0, 5)
                  .map((i) => `• ${i.title}`)
                  .join("\n");
          try {
            await webpush.sendNotification(
              subscription as webpush.PushSubscription,
              JSON.stringify({
                title: `Today: ${todayItems.length} item${todayItems.length === 1 ? "" : "s"}`,
                body,
                url: "/",
              }),
            );
            sent[digestKey] = new Date().toISOString();
          } catch (err) {
            console.error("Digest push failed", err);
          }
        }
      }

      await env.KV.put(sentKey, JSON.stringify(sent), {
        expirationTtl: 86400 * 2,
      });
    }
  },
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
