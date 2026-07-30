#!/usr/bin/env node
/**
 * Generates a VAPID keypair for Web Push.
 *
 * The public key is a base64url raw P-256 point, which is what the browser's
 * pushManager.subscribe() expects. The private key stays a JWK because that is
 * what the WebCrypto signer in the worker consumes.
 */

const { subtle } = globalThis.crypto;

const base64Url = (buffer) =>
  Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const keyPair = await subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);

const privateJwk = await subtle.exportKey("jwk", keyPair.privateKey);
const publicRaw = await subtle.exportKey("raw", keyPair.publicKey);

console.log("VAPID_PUBLIC_KEY (public — safe to commit in the app build):");
console.log(base64Url(publicRaw));
console.log();
console.log("VAPID_PRIVATE_JWK (secret — wrangler secret put VAPID_PRIVATE_JWK):");
console.log(JSON.stringify(privateJwk));
