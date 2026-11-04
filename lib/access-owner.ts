import { AsyncLocalStorage } from "node:async_hooks";
import type { ChatGPTUser } from "../app/chatgpt-auth";

interface AccessConfig {
  RIPEES_ACCESS_ISSUER?: string;
  RIPEES_ACCESS_AUDIENCE?: string;
  RIPEES_ADMIN_EMAIL?: string;
}

interface AccessKey extends JsonWebKey {
  kid?: string;
}

const ownerContext = new AsyncLocalStorage<ChatGPTUser>();

export function withAccessOwner<T>(owner: ChatGPTUser, run: () => T): T {
  return ownerContext.run(owner, run);
}

export function currentAccessOwner(): ChatGPTUser | null {
  return ownerContext.getStore() ?? null;
}

const keyCache = new Map<string, { expires: number; keys: AccessKey[] }>();

function decode(segment: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error("Invalid token encoding");
  return Uint8Array.from(atob(segment.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}

function claims(segment: string): Record<string, unknown> {
  const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decode(segment)));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid token object");
  return value as Record<string, unknown>;
}

async function getKeys(issuer: string): Promise<AccessKey[]> {
  const current = keyCache.get(issuer);
  if (current && current.expires > Date.now()) return current.keys;
  const response = await fetch(issuer + "/cdn-cgi/access/certs", {
    redirect: "manual",
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error("Access keys unavailable");
  const body = await response.json() as { keys?: AccessKey[] };
  if (!Array.isArray(body.keys) || body.keys.length > 32) throw new Error("Invalid Access keys");
  keyCache.set(issuer, { expires: Date.now() + 60_000, keys: body.keys });
  return body.keys;
}

export async function verifyAccessOwner(
  token: string | null,
  config: AccessConfig,
): Promise<ChatGPTUser | null> {
  const issuer = config.RIPEES_ACCESS_ISSUER;
  const audience = config.RIPEES_ACCESS_AUDIENCE;
  const email = config.RIPEES_ADMIN_EMAIL?.trim().toLowerCase();
  if (!issuer || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) ||
      !audience || !email || !token || token.length > 8192) return null;

  try {
    const segments = token.split(".");
    if (segments.length !== 3) return null;
    const [header, payload, signature] = segments;
    const { alg, kid } = claims(header);
    if (alg !== "RS256" || typeof kid !== "string" || !kid) return null;
    const identity = claims(payload);
    const now = Math.floor(Date.now() / 1000);
    if (identity.iss !== issuer || identity.type !== "app" ||
        !Array.isArray(identity.aud) || !identity.aud.includes(audience) ||
        typeof identity.exp !== "number" || !Number.isSafeInteger(identity.exp) || identity.exp <= now ||
        (identity.nbf !== undefined && (typeof identity.nbf !== "number" || !Number.isSafeInteger(identity.nbf) || identity.nbf > now)) ||
        (identity.iat !== undefined && (typeof identity.iat !== "number" || !Number.isSafeInteger(identity.iat) || identity.iat > now + 60)) ||
        typeof identity.sub !== "string" || !identity.sub ||
        typeof identity.email !== "string" || identity.email.toLowerCase() !== email) return null;

    const jwk = (await getKeys(issuer)).find(key => key.kid === kid && key.kty === "RSA" &&
      (!key.alg || key.alg === "RS256") && (!key.use || key.use === "sig"));
    if (!jwk) return null;
    const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
    const key = await crypto.subtle.importKey("jwk", jwk, algorithm, false, ["verify"]);
    const valid = await crypto.subtle.verify(algorithm, key, decode(signature),
      new TextEncoder().encode(header + "." + payload));
    return valid ? { userId: identity.sub, email: identity.email, displayName: identity.email, fullName: null } : null;
  } catch {
    return null;
  }
}
