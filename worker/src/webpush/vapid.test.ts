import { describe, expect, it } from "vitest";

import { base64UrlDecode, base64UrlEncode } from "./base64.js";
import { buildPushRequest } from "./index.js";
import { exportJwk, exportRaw, generateEcdsaKeyPair } from "./test-crypto.js";
import {
  createVapidToken,
  parsePrivateJwk,
  publicKeyFromJwk,
  vapidAuthorizationHeader,
} from "./vapid.js";

const DECODER = new TextDecoder();
const ENDPOINT = "https://web.push.apple.com/abc123";
const SUBJECT = "mailto:me@example.com";

async function signingJwk(): Promise<JsonWebKey> {
  const pair = await generateEcdsaKeyPair();
  return exportJwk(pair.privateKey);
}

function decodeSegment(segment: string): Record<string, unknown> {
  return JSON.parse(DECODER.decode(base64UrlDecode(segment)));
}

describe("VAPID token", () => {
  it("claims the push service origin as the audience", async () => {
    const token = await createVapidToken({
      endpoint: `${ENDPOINT}/long/opaque/path`,
      subject: SUBJECT,
      privateJwk: await signingJwk(),
    });

    expect(decodeSegment(token.split(".")[1]).aud).toBe(
      "https://web.push.apple.com",
    );
  });

  it("signs with ES256 and a verifiable signature", async () => {
    const jwk = await signingJwk();
    const token = await createVapidToken({
      endpoint: ENDPOINT,
      subject: SUBJECT,
      privateJwk: jwk,
    });
    const [header, claims, signature] = token.split(".");

    expect(decodeSegment(header)).toEqual({ typ: "JWT", alg: "ES256" });

    const verifier = await crypto.subtle.importKey(
      "jwk",
      { ...jwk, d: undefined, key_ops: ["verify"] },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      verifier,
      base64UrlDecode(signature) as BufferSource,
      new TextEncoder().encode(`${header}.${claims}`) as BufferSource,
    );

    expect(valid).toBe(true);
  });

  it("expires within the 24 hours push services allow", async () => {
    const now = Date.parse("2026-03-10T00:00:00.000Z");
    const token = await createVapidToken({
      endpoint: ENDPOINT,
      subject: SUBJECT,
      privateJwk: await signingJwk(),
      now,
    });

    const exp = decodeSegment(token.split(".")[1]).exp as number;
    const hours = (exp - now / 1000) / 3600;
    expect(hours).toBeGreaterThan(0);
    expect(hours).toBeLessThanOrEqual(24);
  });

  it("carries a contact subject, without which Apple returns 403", async () => {
    const token = await createVapidToken({
      endpoint: ENDPOINT,
      subject: SUBJECT,
      privateJwk: await signingJwk(),
    });
    expect(decodeSegment(token.split(".")[1]).sub).toBe(SUBJECT);
  });

  it("advertises the public key as an uncompressed point", async () => {
    const jwk = await signingJwk();
    const header = await vapidAuthorizationHeader({
      endpoint: ENDPOINT,
      subject: SUBJECT,
      privateJwk: jwk,
    });

    const key = /k=([\w-]+)$/.exec(header)?.[1] ?? "";
    const bytes = base64UrlDecode(key);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(0x04);
    expect(key).toBe(publicKeyFromJwk(jwk));
  });

  it("rejects a key that is not a P-256 private JWK", () => {
    expect(() => parsePrivateJwk('{"kty":"RSA"}')).toThrow(/P-256/);
    expect(() => parsePrivateJwk('{"kty":"EC","crv":"P-256"}')).toThrow(
      /'d' value/,
    );
  });
});

describe("push request", () => {
  it("uses the content encoding Apple requires", async () => {
    // The npm WebCrypto push libraries emit "aesgcm", which APNs will not take.
    const request = await buildPushRequest({
      subscription: {
        endpoint: ENDPOINT,
        keys: {
          p256dh:
            "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
          auth: "BTBZMqHH6r4Tts7J_aSIgg",
        },
      },
      payload: JSON.stringify({ title: "Dentist", body: "Due now", url: "/" }),
      privateJwk: await signingJwk(),
      subject: SUBJECT,
      ttlSeconds: 3600,
    });

    expect(request.endpoint).toBe(ENDPOINT);
    expect(request.headers["Content-Encoding"]).toBe("aes128gcm");
    expect(request.headers["Content-Type"]).toBe("application/octet-stream");
    expect(request.headers.TTL).toBe("3600");
    expect(request.headers.Authorization).toMatch(
      /^vapid t=[\w.-]+, k=[\w-]+$/,
    );
    // aes128gcm carries its salt and key in the body header, not in a header.
    expect(request.headers.Encryption).toBeUndefined();
    expect(request.body.length).toBeGreaterThan(86);
  });

  it("accepts a JWK supplied as a string, the way a secret arrives", async () => {
    const request = await buildPushRequest({
      subscription: {
        endpoint: ENDPOINT,
        keys: {
          p256dh:
            "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
          auth: "BTBZMqHH6r4Tts7J_aSIgg",
        },
      },
      payload: "{}",
      privateJwk: JSON.stringify(await signingJwk()),
      subject: SUBJECT,
    });

    expect(request.headers.Authorization).toContain("vapid t=");
  });
});

describe("base64url encoding of the public key", () => {
  it("matches the raw export of the same key", async () => {
    const pair = await generateEcdsaKeyPair();
    const jwk = await exportJwk(pair.privateKey);
    const raw = await exportRaw(pair.publicKey);

    expect(publicKeyFromJwk(jwk)).toBe(base64UrlEncode(raw));
  });
});
