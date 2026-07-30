import { encryptPayload } from "./encrypt.js";
import {
  parsePrivateJwk,
  publicKeyFromJwk,
  vapidAuthorizationHeader,
} from "./vapid.js";

export { MAX_PLAINTEXT_BYTES } from "./encrypt.js";
export { publicKeyFromJwk } from "./vapid.js";

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface BuildPushRequestInput {
  subscription: WebPushSubscription;
  payload: string;
  privateJwk: string | JsonWebKey;
  subject: string;
  ttlSeconds?: number;
  urgency?: "very-low" | "low" | "normal" | "high";
  topic?: string;
  now?: number;
}

export interface PushHttpRequest {
  endpoint: string;
  headers: Record<string, string>;
  body: Uint8Array;
}

/**
 * Assembles the single HTTP request that delivers a push message, per RFC 8030
 * transport, RFC 8291 encryption and RFC 8292 authentication.
 */
export async function buildPushRequest(
  input: BuildPushRequestInput,
): Promise<PushHttpRequest> {
  const jwk = parsePrivateJwk(input.privateJwk);

  const body = await encryptPayload({
    plaintext: input.payload,
    uaPublicKey: input.subscription.keys.p256dh,
    authSecret: input.subscription.keys.auth,
  });

  const headers: Record<string, string> = {
    Authorization: await vapidAuthorizationHeader({
      endpoint: input.subscription.endpoint,
      subject: input.subject,
      privateJwk: jwk,
      now: input.now,
    }),
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    TTL: String(input.ttlSeconds ?? 6 * 60 * 60),
  };

  if (input.urgency) headers.Urgency = input.urgency;
  if (input.topic) headers.Topic = input.topic;
  // Some Chromium builds still look for the signing key here.
  headers["Crypto-Key"] = `p256ecdsa=${publicKeyFromJwk(jwk)}`;

  return { endpoint: input.subscription.endpoint, headers, body };
}
