import { base64UrlDecode, base64UrlEncode, concat } from "./base64.js";

/** Voluntary Application Server Identification (VAPID), RFC 8292. */

const ENCODER = new TextEncoder();

/** See the note in encrypt.ts about the Workers WebCrypto type definitions. */
const subtle = crypto.subtle as unknown as SubtleCrypto;

/** Push services reject a token valid for more than 24 hours. */
const DEFAULT_TTL_SECONDS = 12 * 60 * 60;

export interface VapidInput {
  endpoint: string;
  subject: string;
  privateJwk: JsonWebKey;
  now?: number;
  expiresInSeconds?: number;
}

/** The "k" parameter is the raw uncompressed point, not the JWK. */
export function publicKeyFromJwk(jwk: JsonWebKey): string {
  if (!jwk.x || !jwk.y)
    throw new Error("VAPID key is missing its public point.");
  return base64UrlEncode(
    concat(
      new Uint8Array([0x04]),
      base64UrlDecode(jwk.x),
      base64UrlDecode(jwk.y),
    ),
  );
}

export function parsePrivateJwk(value: string | JsonWebKey): JsonWebKey {
  const jwk =
    typeof value === "string" ? (JSON.parse(value) as JsonWebKey) : value;
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.d) {
    throw new Error(
      "VAPID private key must be a P-256 EC JWK with a 'd' value.",
    );
  }
  return jwk;
}

export async function createVapidToken(input: VapidInput): Promise<string> {
  const jwk = parsePrivateJwk(input.privateJwk);
  const now = Math.floor((input.now ?? Date.now()) / 1000);

  const header = { typ: "JWT", alg: "ES256" };
  const claims = {
    aud: new URL(input.endpoint).origin,
    exp: now + (input.expiresInSeconds ?? DEFAULT_TTL_SECONDS),
    sub: input.subject,
  };

  const signingInput = `${base64UrlEncode(
    ENCODER.encode(JSON.stringify(header)),
  )}.${base64UrlEncode(ENCODER.encode(JSON.stringify(claims)))}`;

  const key = await subtle.importKey(
    "jwk",
    { ...jwk, key_ops: ["sign"] },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  // WebCrypto already returns the raw r||s pair that JOSE expects.
  const signature = await subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    ENCODER.encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function vapidAuthorizationHeader(
  input: VapidInput,
): Promise<string> {
  const jwk = parsePrivateJwk(input.privateJwk);
  const token = await createVapidToken({ ...input, privateJwk: jwk });
  return `vapid t=${token}, k=${publicKeyFromJwk(jwk)}`;
}
