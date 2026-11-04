import assert from "node:assert/strict";
import { verifyAccessOwner } from "../lib/access-owner.ts";

const issuer = "https://ripees-test.cloudflareaccess.com";
const config = {
  RIPEES_ACCESS_ISSUER: issuer,
  RIPEES_ACCESS_AUDIENCE: "test-audience",
  RIPEES_ADMIN_EMAIL: "owner@example.test",
};
const keys = await crypto.subtle.generateKey({
  name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256",
}, true, ["sign", "verify"]);
const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  assert.equal(options.redirect, "manual");
  assert.equal(url, issuer + "/cdn-cgi/access/certs");
  return Response.json({ keys: [{ ...jwk, kid: "owner-test", alg: "RS256", use: "sig" }] });
};
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const payload = { iss: issuer, aud: ["test-audience"], sub: "synthetic-owner",
  type: "app", email: "owner@example.test", iat: now, exp: now + 600 };

async function token(overrides = {}, headerOverrides = {}) {
  const prefix = encode({ alg: "RS256", kid: "owner-test", ...headerOverrides }) + "." +
    encode({ ...payload, ...overrides });
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, Buffer.from(prefix));
  return prefix + "." + Buffer.from(signature).toString("base64url");
}

try {
  const valid = await token();
  assert.equal((await verifyAccessOwner(valid, config))?.userId, "synthetic-owner");
  assert.equal(await verifyAccessOwner(valid, {}), null);
  for (const candidate of [
    null, "forged-identity-header", valid.slice(0, valid.lastIndexOf(".")) + ".AA",
    await token({ email: "visitor@example.test" }),
    await token({ iss: "https://different.cloudflareaccess.com" }),
    await token({ aud: ["different-app"] }),
    await token({ exp: now - 1 }),
    await token({ nbf: now + 120 }),
    await token({ type: "service" }),
    await token({}, { alg: "none" }),
    await token({}, { kid: "other-key" }),
  ]) assert.equal(await verifyAccessOwner(candidate, config), null);
} finally {
  globalThis.fetch = originalFetch;
}
console.log("PASS signed owner assertion and 12 missing, forged or unauthorized cases");
