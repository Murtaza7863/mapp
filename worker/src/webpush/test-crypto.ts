/**
 * Test-only WebCrypto helpers.
 *
 * The Workers type definitions return unions from generateKey and exportKey,
 * so narrowing happens here instead of at every call site in the tests.
 */

const subtle = crypto.subtle as unknown as SubtleCrypto;

export async function generateEcdsaKeyPair(): Promise<CryptoKeyPair> {
  return (await subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
}

export async function generateEcdhKeyPair(): Promise<CryptoKeyPair> {
  return (await subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
}

export async function exportJwk(key: CryptoKey): Promise<JsonWebKey> {
  return (await subtle.exportKey("jwk", key)) as JsonWebKey;
}

export async function exportRaw(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array((await subtle.exportKey("raw", key)) as ArrayBuffer);
}
