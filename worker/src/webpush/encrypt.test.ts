import { describe, expect, it } from "vitest";

import { base64UrlDecode, base64UrlEncode } from "./base64.js";
import { encryptPayload, MAX_PLAINTEXT_BYTES } from "./encrypt.js";

/**
 * Test vector from RFC 8291 Section 5 and Appendix A. Reproducing the exact
 * ciphertext proves the ECDH, HKDF, padding, header and AES-GCM steps are all
 * correct, which is the only way to be confident without a real device.
 */
const VECTOR = {
  plaintext: "When I grow up, I want to be a watermelon",
  authSecret: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  uaPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  senderPublic:
    "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  senderPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  expectedBody:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

/** WebCrypto cannot import a raw private scalar, so rebuild the JWK. */
async function senderKeyPair(): Promise<CryptoKeyPair> {
  const publicBytes = base64UrlDecode(VECTOR.senderPublic);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: VECTOR.senderPrivate,
    x: base64UrlEncode(publicBytes.slice(1, 33)),
    y: base64UrlEncode(publicBytes.slice(33, 65)),
    ext: true,
  };

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const publicKey = await crypto.subtle.importKey(
    "raw",
    publicBytes as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );
  return { privateKey, publicKey };
}

describe("RFC 8291 aes128gcm encryption", () => {
  it("reproduces the specification's example ciphertext exactly", async () => {
    const body = await encryptPayload({
      plaintext: VECTOR.plaintext,
      uaPublicKey: VECTOR.uaPublic,
      authSecret: VECTOR.authSecret,
      salt: base64UrlDecode(VECTOR.salt),
      senderKeys: await senderKeyPair(),
    });

    expect(base64UrlEncode(body)).toBe(VECTOR.expectedBody);
  });

  it("writes the 86-octet header the spec describes", async () => {
    const body = await encryptPayload({
      plaintext: VECTOR.plaintext,
      uaPublicKey: VECTOR.uaPublic,
      authSecret: VECTOR.authSecret,
      salt: base64UrlDecode(VECTOR.salt),
      senderKeys: await senderKeyPair(),
    });

    const header = body.slice(0, 86);
    expect(base64UrlEncode(header.slice(0, 16))).toBe(VECTOR.salt);
    expect(
      new DataView(header.buffer, header.byteOffset, 86).getUint32(16),
    ).toBe(4096);
    expect(header[20]).toBe(65);
    expect(base64UrlEncode(header.slice(21, 86))).toBe(VECTOR.senderPublic);
  });

  it("produces a different body each time when the salt is random", async () => {
    const args = {
      plaintext: "hello",
      uaPublicKey: VECTOR.uaPublic,
      authSecret: VECTOR.authSecret,
    };
    const [a, b] = await Promise.all([
      encryptPayload(args),
      encryptPayload(args),
    ]);

    expect(base64UrlEncode(a)).not.toBe(base64UrlEncode(b));
  });
});

describe("input validation", () => {
  const base = {
    plaintext: "hi",
    uaPublicKey: VECTOR.uaPublic,
    authSecret: VECTOR.authSecret,
  };

  it("rejects a malformed subscription key", async () => {
    await expect(
      encryptPayload({
        ...base,
        uaPublicKey: base64UrlEncode(new Uint8Array(10)),
      }),
    ).rejects.toThrow(/uncompressed P-256 point/);
  });

  it("rejects an auth secret of the wrong length", async () => {
    await expect(
      encryptPayload({
        ...base,
        authSecret: base64UrlEncode(new Uint8Array(8)),
      }),
    ).rejects.toThrow(/16 octets/);
  });

  it("rejects a payload too large for a single record", async () => {
    await expect(
      encryptPayload({
        ...base,
        plaintext: "x".repeat(MAX_PLAINTEXT_BYTES + 1),
      }),
    ).rejects.toThrow(/limit is/);
  });
});

describe("base64url", () => {
  it("round-trips bytes that need padding", () => {
    for (let length = 1; length <= 8; length += 1) {
      const bytes = crypto.getRandomValues(new Uint8Array(length));
      expect(base64UrlDecode(base64UrlEncode(bytes))).toEqual(bytes);
    }
  });

  it("emits url-safe characters only", () => {
    const encoded = base64UrlEncode(new Uint8Array([251, 255, 190, 0]));
    expect(encoded).not.toMatch(/[+/=]/);
  });
});
