import { describe, expect, it, vi } from "vitest";

import { sendPush } from "./push.js";
import type { PushSubscriptionJSON } from "./types.js";
import { base64UrlEncode } from "./webpush/base64.js";
import {
  exportJwk,
  exportRaw,
  generateEcdhKeyPair,
  generateEcdsaKeyPair,
} from "./webpush/test-crypto.js";

/** A VAPID signing key, the same shape scripts/generate-vapid-keys.mjs emits. */
async function vapidPrivateJwk(): Promise<string> {
  const pair = await generateEcdsaKeyPair();
  return JSON.stringify(await exportJwk(pair.privateKey));
}

/** Stands in for what a real browser hands back from pushManager.subscribe(). */
async function browserSubscription(): Promise<PushSubscriptionJSON> {
  const pair = await generateEcdhKeyPair();
  return {
    endpoint: "https://web.push.apple.com/example-device",
    keys: {
      p256dh: base64UrlEncode(await exportRaw(pair.publicKey)),
      auth: base64UrlEncode(crypto.getRandomValues(new Uint8Array(16))),
    },
  };
}

async function options() {
  return {
    privateJWK: await vapidPrivateJwk(),
    subject: "mailto:me@example.com",
  };
}

const payload = { title: "Dentist", body: "Due now", url: "/" };

describe("web push encryption", () => {
  it("signs and encrypts using WebCrypto only", async () => {
    // The previous implementation used the `web-push` npm package, which calls
    // crypto.createECDH and therefore throws on every Cloudflare Workers run.
    const requests: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return new Response(null, { status: 201 });
    });

    const result = await sendPush(
      await browserSubscription(),
      payload,
      await options(),
    );
    vi.unstubAllGlobals();

    expect(result).toEqual({ status: "sent" });
    expect(requests).toHaveLength(1);

    const headers = new Headers(requests[0].init.headers);
    expect(headers.get("Authorization")).toMatch(/^vapid t=.+, k=.+/);
    // Apple's push service only accepts the RFC 8291 coding.
    expect(headers.get("Content-Encoding")).toBe("aes128gcm");
    expect((requests[0].init.body as Uint8Array).byteLength).toBeGreaterThan(
      86,
    );
  });

  it("reports a dead subscription so it can be pruned", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 410 }));
    const result = await sendPush(
      await browserSubscription(),
      payload,
      await options(),
    );
    vi.unstubAllGlobals();

    expect(result).toEqual({ status: "expired" });
  });

  it("surfaces a push service rejection instead of failing silently", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response("bad vapid", { status: 403 }),
    );
    const result = await sendPush(
      await browserSubscription(),
      payload,
      await options(),
    );
    vi.unstubAllGlobals();

    expect(result.status).toBe("failed");
    expect(result).toMatchObject({ detail: expect.stringContaining("403") });
  });

  it("does not throw when the network is down", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("connection reset");
    });
    const result = await sendPush(
      await browserSubscription(),
      payload,
      await options(),
    );
    vi.unstubAllGlobals();

    expect(result).toEqual({ status: "failed", detail: "connection reset" });
  });
});
