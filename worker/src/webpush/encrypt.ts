import { base64UrlDecode, concat } from "./base64.js";

/**
 * Message encryption for Web Push, RFC 8291, using the "aes128gcm" content
 * coding of RFC 8188.
 *
 * This is hand-rolled because the WebCrypto-based push libraries on npm still
 * emit the superseded "aesgcm" coding from the pre-RFC drafts. Apple's push
 * service only accepts aes128gcm, so that path cannot reach an iPhone.
 *
 * Correctness is pinned to the official test vector in RFC 8291 Section 5;
 * see encrypt.test.ts.
 */

const ENCODER = new TextEncoder();

/**
 * @cloudflare/workers-types models parts of WebCrypto loosely: generateKey and
 * exportKey return unions, and the ECDH peer key is typed `$public` even though
 * the runtime reads `public` (cloudflare/workerd#3466). Going through the
 * standard SubtleCrypto shape keeps these call sites spec-correct.
 */
const subtle = crypto.subtle as unknown as SubtleCrypto;

/** RFC 8188 caps a push message at one record; 4096 is the standard size. */
const RECORD_SIZE = 4096;
const AUTH_TAG_BYTES = 16;
const PADDING_DELIMITER_BYTES = 1;
const HEADER_BYTES = 86;

/** Push services need not accept a body larger than 4096 octets. */
export const MAX_PLAINTEXT_BYTES =
  RECORD_SIZE - HEADER_BYTES - PADDING_DELIMITER_BYTES - AUTH_TAG_BYTES;

export interface EncryptInput {
  plaintext: string;
  /** The subscription's p256dh value, base64url. */
  uaPublicKey: string;
  /** The subscription's auth value, base64url (16 octets). */
  authSecret: string;
  /** Overridable so tests can reproduce the RFC vector. */
  salt?: Uint8Array;
  senderKeys?: CryptoKeyPair;
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  lengthBytes: number,
): Promise<Uint8Array> {
  const key = await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    lengthBytes * 8,
  );
  return new Uint8Array(bits);
}

export async function generateSenderKeys(): Promise<CryptoKeyPair> {
  return (await subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
}

export async function encryptPayload(input: EncryptInput): Promise<Uint8Array> {
  const plaintext = ENCODER.encode(input.plaintext);
  if (plaintext.length > MAX_PLAINTEXT_BYTES) {
    throw new Error(
      `Push payload is ${plaintext.length} bytes; the limit is ${MAX_PLAINTEXT_BYTES}.`,
    );
  }

  const uaPublic = base64UrlDecode(input.uaPublicKey);
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) {
    throw new Error(
      "Subscription p256dh key is not an uncompressed P-256 point.",
    );
  }

  const authSecret = base64UrlDecode(input.authSecret);
  if (authSecret.length !== 16) {
    throw new Error("Subscription auth secret must be 16 octets.");
  }

  const salt = input.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const senderKeys = input.senderKeys ?? (await generateSenderKeys());
  const senderPublic = new Uint8Array(
    (await subtle.exportKey("raw", senderKeys.publicKey)) as ArrayBuffer,
  );

  const uaKey = await subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  // The runtime reads `public`; only the Workers type says `$public`.
  const ecdhAlgorithm = {
    name: "ECDH",
    public: uaKey,
  } as unknown as Parameters<typeof subtle.deriveBits>[0];
  const ecdhSecret = new Uint8Array(
    await subtle.deriveBits(ecdhAlgorithm, senderKeys.privateKey, 256),
  );

  // key_info = "WebPush: info" || 0x00 || ua_public || as_public
  const keyInfo = concat(
    ENCODER.encode("WebPush: info"),
    new Uint8Array([0]),
    uaPublic,
    senderPublic,
  );
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  const contentEncryptionKey = await hkdf(
    salt,
    ikm,
    ENCODER.encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdf(
    salt,
    ikm,
    ENCODER.encode("Content-Encoding: nonce\0"),
    12,
  );

  const aesKey = await subtle.importKey(
    "raw",
    contentEncryptionKey,
    "AES-GCM",
    false,
    ["encrypt"],
  );
  // 0x02 marks the final (and only) record.
  const padded = concat(plaintext, new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(
    await subtle.encrypt(
      { name: "AES-GCM", iv: nonce, tagLength: AUTH_TAG_BYTES * 8 },
      aesKey,
      padded,
    ),
  );

  // header = salt(16) || record size(4, big endian) || keyid length(1) || keyid
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, RECORD_SIZE);
  const header = concat(
    salt,
    recordSize,
    new Uint8Array([senderPublic.length]),
    senderPublic,
  );

  return concat(header, ciphertext);
}
