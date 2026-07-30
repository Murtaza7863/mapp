import type { PushMessagePayload, PushSubscriptionJSON } from "./types.js";
import { buildPushRequest } from "./webpush/index.js";

export type SendResult =
  | { status: "sent" }
  | { status: "expired" }
  | { status: "failed"; detail: string };

/** Push services use these to say the subscription is permanently dead. */
const GONE_STATUSES = new Set([404, 410]);

export async function sendPush(
  subscription: PushSubscriptionJSON,
  payload: PushMessagePayload,
  options: { privateJWK: string; subject: string; ttlSeconds?: number },
): Promise<SendResult> {
  let request: Awaited<ReturnType<typeof buildPushRequest>>;
  try {
    request = await buildPushRequest({
      subscription,
      payload: JSON.stringify(payload),
      privateJwk: options.privateJWK,
      subject: options.subject,
      ttlSeconds: options.ttlSeconds,
      urgency: "high",
    });
  } catch (err) {
    return {
      status: "failed",
      detail: `encrypt: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  try {
    const res = await fetch(request.endpoint, {
      method: "POST",
      headers: request.headers,
      body: request.body as BodyInit,
    });

    if (res.ok) return { status: "sent" };
    if (GONE_STATUSES.has(res.status)) return { status: "expired" };

    const detail = await res.text().catch(() => "");
    return {
      status: "failed",
      detail: `${res.status} ${detail.slice(0, 200)}`,
    };
  } catch (err) {
    return {
      status: "failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
