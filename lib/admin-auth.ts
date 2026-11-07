import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { ADMIN_SESSION_COOKIE, getAdminSessionUser } from "./admin-session";

const SESSION_COOKIE = ADMIN_SESSION_COOKIE;
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const PASSWORD_ITERATIONS = 100_000; // Cloudflare Workers Web Crypto rejects higher PBKDF2 counts.
const encoder = new TextEncoder();
const DUMMY_PASSWORD_HASH = `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${"0".repeat(32)}$${"0".repeat(64)}`;

export type AdminUser = {
  userId: string;
  email: string;
  displayName: string;
  fullName: string | null;
};

function database() {
  if (!env.DB) throw new Error("Database unavailable");
  return env.DB;
}

function pepper(): string {
  if (!env.RIPEES_AUTH_PEPPER || env.RIPEES_AUTH_PEPPER.length < 32) {
    throw new Error("RIPEES_AUTH_PEPPER must contain at least 32 characters.");
  }
  return env.RIPEES_AUTH_PEPPER;
}

function allowedEmails(): Set<string> {
  return new Set(
    (env.RIPEES_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : null;
}

function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 12 && value.length <= 128;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes = 32): string {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function digest(value: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function keyedDigest(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS },
    key,
    256,
  );
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${hex(salt)}$${hex(new Uint8Array(bits))}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, rounds, salt, expected] = stored.split("$");
  const iterations = Number(rounds);
  if (
    algorithm !== "pbkdf2-sha256" ||
    !Number.isInteger(iterations) ||
    iterations < 100_000 ||
    iterations > 1_000_000 ||
    !/^[0-9a-f]{32}$/.test(salt ?? "") ||
    !/^[0-9a-f]{64}$/.test(expected ?? "")
  ) {
    throw new Error("Stored admin password hash is invalid.");
  }
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: Uint8Array.from(salt.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16)),
      iterations,
    },
    key,
    256,
  );
  return constantTimeEqual(hex(new Uint8Array(bits)), expected);
}

async function rateAllowed(req: Request, key: string, limit: number): Promise<boolean> {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  await database().prepare("DELETE FROM admin_auth_limits WHERE window_started_at<=?").bind(now - windowMs).run();
  const increment = (id: string) =>
    database()
      .prepare(
        "INSERT INTO admin_auth_limits (key,count,window_started_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN admin_auth_limits.window_started_at<=? THEN 1 ELSE admin_auth_limits.count+1 END,window_started_at=CASE WHEN admin_auth_limits.window_started_at<=? THEN excluded.window_started_at ELSE admin_auth_limits.window_started_at END WHERE admin_auth_limits.window_started_at<=? OR admin_auth_limits.count<? RETURNING count",
      )
      .bind(id, now, now - windowMs, now - windowMs, now - windowMs, limit)
      .first();
  const account = await increment(await keyedDigest(`auth:${key}`));
  const client = await increment(
    await keyedDigest(`auth:${key}:${req.headers.get("cf-connecting-ip") ?? "local"}`),
  );
  return Boolean(account && client);
}

function json(data: unknown, status = 200, headersInit?: HeadersInit): Response {
  const responseHeaders = new Headers(headersInit);
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  responseHeaders.set("Referrer-Policy", "no-referrer");
  return Response.json(data, { status, headers: responseHeaders });
}

function sameOrigin(req: Request): boolean {
  return req.headers.get("origin") === new URL(req.url).origin &&
    req.headers.get("sec-fetch-site") !== "cross-site";
}

function cookieValue(requestHeaders: Headers, cookieName: string): string | null {
  for (const part of (requestHeaders.get("cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === cookieName) return value.join("=") || null;
  }
  return null;
}

function sessionCookie(token: string, req: Request): string {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_LIFETIME_MS / 1000}; HttpOnly; SameSite=Strict${secure}`;
}

function clearSessionCookie(req: Request): string {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure}`;
}

function makeRecoveryCodes(): string[] {
  return Array.from({ length: 10 }, () => randomHex(16).toUpperCase());
}

async function insertRecoveryCodes(
  userId: string,
  email: string,
  codes: string[],
  setupCondition?: { tokenId: string; claimId: string },
  recoveryCondition?: { codeId: string; claimId: string },
) {
  const statements = await Promise.all(
    codes.map(async (code) => {
      const codeHash = await keyedDigest(`recovery:${code}`);
      if (setupCondition) {
        return database()
          .prepare("INSERT INTO admin_recovery_codes (id,user_id,code_hash) SELECT ?,admin_users.id,? FROM admin_users WHERE admin_users.email=? AND EXISTS (SELECT 1 FROM admin_setup_tokens WHERE id=? AND claim_id=?)")
          .bind(crypto.randomUUID(), codeHash, email, setupCondition.tokenId, setupCondition.claimId);
      }
      if (recoveryCondition) {
        return database()
          .prepare("INSERT INTO admin_recovery_codes (id,user_id,code_hash) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM admin_recovery_codes WHERE id=? AND claim_id=?)")
          .bind(crypto.randomUUID(), userId, codeHash, recoveryCondition.codeId, recoveryCondition.claimId);
      }
      return database()
        .prepare("INSERT INTO admin_recovery_codes (id,user_id,code_hash) VALUES (?,?,?)")
        .bind(crypto.randomUUID(), userId, codeHash);
    }),
  );
  return statements;
}

async function handleAction(req: Request, body: Record<string, unknown>): Promise<Response> {
  const db = database();
  if (body.action === "complete-setup") {
    const token = typeof body.token === "string" ? body.token : "";
    if (!/^[0-9a-f]{64}$/.test(token) || !validPassword(body.password)) {
      return json({ error: "Use a valid setup link and a password between 12 and 128 characters." }, 400);
    }
    if (!(await rateAllowed(req, `setup:${token}`, 8))) {
      return json({ error: "Too many setup attempts. Ask the operator for a new setup link." }, 429);
    }
    const tokenHash = await keyedDigest(`setup:${token}`);
    const setup = await db
      .prepare("SELECT id,email FROM admin_setup_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>? AND attempts<8")
      .bind(tokenHash, Date.now())
      .first<{ id: string; email: string }>();
    if (!setup || !allowedEmails().has(setup.email)) {
      return json({ error: "This setup link is invalid, expired, or no longer authorized." }, 400);
    }
    const now = Date.now();
    const claimId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const codes = makeRecoveryCodes();
    const passwordHash = await hashPassword(body.password);
    const codeStatements = await insertRecoveryCodes(userId, setup.email, codes, {
      tokenId: setup.id,
      claimId,
    });
    const statements = [
      db.prepare("UPDATE admin_setup_tokens SET used_at=?,claim_id=?,attempts=attempts+1 WHERE id=? AND used_at IS NULL AND expires_at>? AND attempts<8")
        .bind(now, claimId, setup.id, now),
      db.prepare("INSERT INTO admin_users (id,email,password_hash,created_at,updated_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM admin_setup_tokens WHERE id=? AND claim_id=?) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,updated_at=excluded.updated_at")
        .bind(userId, setup.email, passwordHash, new Date(now).toISOString(), new Date(now).toISOString(), setup.id, claimId),
      db.prepare("DELETE FROM admin_sessions WHERE user_id=(SELECT id FROM admin_users WHERE email=?) AND EXISTS (SELECT 1 FROM admin_setup_tokens WHERE id=? AND claim_id=?)")
        .bind(setup.email, setup.id, claimId),
      db.prepare("DELETE FROM admin_recovery_codes WHERE user_id=(SELECT id FROM admin_users WHERE email=?) AND EXISTS (SELECT 1 FROM admin_setup_tokens WHERE id=? AND claim_id=?)")
        .bind(setup.email, setup.id, claimId),
      ...codeStatements,
    ];
    const result = await db.batch(statements);
    if (!result[0]?.meta.changes) return json({ error: "This setup link has already been used." }, 409);
    return json({ ok: true, email: setup.email, recoveryCodes: codes });
  }

  if (body.action === "login") {
    const email = normalizeEmail(body.email);
    const password = body.password;
    if (!email || typeof password !== "string" || password.length > 128) {
      return json({ error: "Email or password is incorrect." }, 401);
    }
    if (!(await rateAllowed(req, `login:${email}`, 10))) {
      return json({ error: "Too many sign-in attempts. Try again later." }, 429);
    }
    const user = await db
      .prepare("SELECT id,email,password_hash FROM admin_users WHERE email=?")
      .bind(email)
      .first<{ id: string; email: string; password_hash: string }>();
    const passwordMatches = await verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
    if (!user || !allowedEmails().has(email) || !passwordMatches) {
      return json({ error: "Email or password is incorrect." }, 401);
    }
    const token = randomHex();
    const now = Date.now();
    await db.prepare("DELETE FROM admin_sessions WHERE expires_at<=?").bind(now).run();
    await db
      .prepare("INSERT INTO admin_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)")
      .bind(await digest(token), user.id, new Date(now).toISOString(), now + SESSION_LIFETIME_MS)
      .run();
    return json(
      { ok: true, redirectTo: "/admin" },
      200,
      { "Set-Cookie": sessionCookie(token, req) },
    );
  }

  if (body.action === "reset-password") {
    const email = normalizeEmail(body.email);
    const code = typeof body.recoveryCode === "string"
      ? body.recoveryCode.trim().toUpperCase()
      : "";
    if (!email || !validPassword(body.password) || !/^[0-9A-F]{32}$/.test(code)) {
      return json({ error: "Enter the account email, a valid recovery code, and a password of at least 12 characters." }, 400);
    }
    if (!(await rateAllowed(req, `recovery:${email}`, 8))) {
      return json({ error: "Too many recovery attempts. Try again later." }, 429);
    }
    const user = await db
      .prepare("SELECT id FROM admin_users WHERE email=?")
      .bind(email)
      .first<{ id: string }>();
    if (!user || !allowedEmails().has(email)) {
      return json({ error: "The recovery details are invalid." }, 400);
    }
    const codeHash = await keyedDigest(`recovery:${code}`);
    const recoveryCode = await db
      .prepare("SELECT id FROM admin_recovery_codes WHERE user_id=? AND code_hash=? AND used_at IS NULL")
      .bind(user.id, codeHash)
      .first<{ id: string }>();
    if (!recoveryCode) return json({ error: "The recovery code is invalid or already used." }, 400);
    const now = Date.now();
    const claimId = crypto.randomUUID();
    const newCodes = makeRecoveryCodes();
    const passwordHash = await hashPassword(body.password);
    const codeStatements = await insertRecoveryCodes(user.id, email, newCodes, undefined, {
      codeId: recoveryCode.id,
      claimId,
    });
    const result = await db.batch([
      db.prepare("UPDATE admin_recovery_codes SET used_at=?,claim_id=? WHERE id=? AND used_at IS NULL")
        .bind(now, claimId, recoveryCode.id),
      db.prepare("UPDATE admin_users SET password_hash=?,updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM admin_recovery_codes WHERE id=? AND claim_id=?)")
        .bind(passwordHash, new Date(now).toISOString(), user.id, recoveryCode.id, claimId),
      db.prepare("DELETE FROM admin_sessions WHERE user_id=? AND EXISTS (SELECT 1 FROM admin_recovery_codes WHERE id=? AND claim_id=?)")
        .bind(user.id, recoveryCode.id, claimId),
      db.prepare("DELETE FROM admin_recovery_codes WHERE user_id=? AND id<>? AND EXISTS (SELECT 1 FROM admin_recovery_codes WHERE id=? AND claim_id=?)")
        .bind(user.id, recoveryCode.id, recoveryCode.id, claimId),
      ...codeStatements,
    ]);
    if (!result[0]?.meta.changes) return json({ error: "The recovery code is invalid or already used." }, 400);
    return json({ ok: true, recoveryCodes: newCodes });
  }

  if (body.action === "logout") {
    const token = cookieValue(req.headers, SESSION_COOKIE);
    if (token) {
      await db.prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(await digest(token)).run();
    }
    return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(req) });
  }
  return json({ error: "Unknown authentication action." }, 400);
}

export async function adminAuthPost(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return json({ error: "Request was rejected." }, 403);
  try {
    const raw = await req.text();
    if (encoder.encode(raw).byteLength > 16_384) return json({ error: "Request is too large." }, 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid request." }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Invalid request." }, 400);
    }
    return await handleAction(req, body as Record<string, unknown>);
  } catch (error) {
    console.error("Admin authentication failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Authentication could not be completed. Please retry." }, 503);
  }
}

export async function getAdminUser(): Promise<AdminUser | null> {
  return getAdminSessionUser(await headers(), database(), env.RIPEES_ADMIN_EMAILS);
}
