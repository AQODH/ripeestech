import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Miniflare } from "miniflare";

const directory = path.resolve("dist/server");
const config = JSON.parse(fs.readFileSync(path.join(directory, "wrangler.json"), "utf8"));
const entry = path.join(directory, config.main);
const modules = fs.readdirSync(directory, { recursive: true, withFileTypes: true })
  .filter(file => file.isFile() && /\.(?:m?js)$/.test(file.name))
  .map(file => path.join(file.parentPath, file.name))
  .filter(file => file !== entry);
const issuer = "https://ripees-fixture.cloudflareaccess.com";
const host = "ripees-staging.test";
const audience = "synthetic-audience";
const email = "owner@example.test";
const pair = await crypto.subtle.generateKey({
  name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256",
}, true, ["sign", "verify"]);
const key = await crypto.subtle.exportKey("jwk", pair.publicKey);
const encode = object => Buffer.from(JSON.stringify(object)).toString("base64url");

async function assertion(claims = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: issuer, aud: [audience], sub: "synthetic-owner", email,
    type: "app", exp: now + 300, ...claims };
  const body = encode({ alg: "RS256", kid: "fixture" }) + "." + encode(payload);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, Buffer.from(body));
  return body + "." + Buffer.from(signature).toString("base64url");
}

let keyRequests = 0;
const runtime = new Miniflare({
  modules: [entry, ...modules].map(file => ({ type: "ESModule", path: file })),
  modulesRoot: directory,
  compatibilityDate: config.compatibility_date,
  compatibilityFlags: config.compatibility_flags,
  d1Databases: { DB: "ripees-built-fixture" },
  bindings: {
    RIPEES_ADMIN_HOST: host, RIPEES_ACCESS_ISSUER: issuer, RIPEES_ACCESS_AUDIENCE: audience,
    RIPEES_ADMIN_EMAIL: email, RIPEES_ADMIN_EMAILS: email,
    RIPEES_AUTH_PEPPER: "built-worker-test-pepper-with-at-least-32-characters",
    RIPEES_ENABLE_AI: "false",
  },
  outboundService: request => {
    keyRequests++;
    if (request.url === issuer + "/cdn-cgi/access/certs") return Response.json({ keys: [{ ...key, kid: "fixture", alg: "RS256" }] });
    return new Response("External requests disabled in this test.", { status: 502 });
  },
});

const request = (route, options) => runtime.dispatchFetch("https://" + host + route, options);
try {
  assert.equal((await request("/api/health")).status, 503);
  const database = await runtime.getD1Database("DB");
  for (const name of fs.readdirSync("drizzle").filter(file => file.endsWith(".sql")).sort()) {
    await database.batch(fs.readFileSync("drizzle/" + name, "utf8").split("--> statement-breakpoint")
      .filter(sql => sql.trim()).map(sql => database.prepare(sql)));
  }
  assert.equal((await request("/admin/login")).status, 200);
  const loginAttempt = await request("/api/admin-auth", {
    method: "POST", headers: {"content-type":"application/json", origin:"https://"+host},
    body: JSON.stringify({action:"login",email,password:"incorrect"}),
  });
  assert.equal(loginAttempt.status, 401);
  assert.equal((await request("/api/health")).status, 200);
  const website = await request("/website");
  assert.equal(website.status, 200);
  assert.match(await website.text(), /\/favicon\.svg\?v=ripees/);
  assert.ok(fs.existsSync("dist/client/favicon.ico"));
  for (const route of ["/terms", "/privacy"]) assert.equal((await request(route)).status, 200);
  assert.equal((await request("/admin")).status, 403);
  assert.equal((await request("/api/admin", { headers: {
    "oai-authenticated-user-email": email, "oai-authenticated-user-id": "forged",
  } })).status, 403);
  const sessionToken = "b".repeat(64);
  const sessionHash = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionToken))).toString("hex");
  await database.prepare("INSERT INTO admin_users (id,email,password_hash,created_at,updated_at) VALUES (?,?,?,?,?)")
    .bind("session-owner", email, "unused", new Date().toISOString(), new Date().toISOString()).run();
  await database.prepare("INSERT INTO admin_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)")
    .bind(sessionHash, "session-owner", new Date().toISOString(), Date.now() + 86400000).run();
  const session = {cookie:"ripees_admin_session="+sessionToken};
  const sessionAuthorized = await request("/api/admin", {headers:session});
  assert.equal(sessionAuthorized.status, 200);
  assert.equal((await sessionAuthorized.json()).ownerName, email);
  for (const claims of [{email:"visitor@example.test"}, {exp:1}]) {
    assert.equal((await request("/api/admin", { headers: {
      "cf-access-jwt-assertion": await assertion(claims),
    } })).status, 403);
  }
  const auth = { "cf-access-jwt-assertion": await assertion() };
  const authorized = await request("/api/admin", { headers: auth });
  assert.equal(authorized.status, 200, authorized.ok ? undefined : "Signing key requests: "+keyRequests+"; "+await authorized.clone().text());
  assert.equal(authorized.headers.get("Cache-Control"), "private, no-store");
  assert.equal((await authorized.json()).ownerName, email);
  assert.equal((await request("/admin", { headers: auth })).status, 200);
  assert.equal((await runtime.dispatchFetch("https://alternate.test/api/backup", { headers: auth })).status, 403);
  const enquiry = { name: "Synthetic contact", company: "Fixture shop", email: "fixture@example.test",
    interest: "Ecommerce", message: "Synthetic local Worker test enquiry.", requestKey: crypto.randomUUID() };
  const submission = { method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify(enquiry) };
  assert.equal((await request("/api/enquiries", submission)).status, 200);
  assert.equal((await request("/api/enquiries", submission)).status, 200);
  const leads = await request("/api/leads?q=Fixture", {headers:auth});
  assert.equal(leads.status, 200);
  assert.equal((await leads.json()).total, 1);
  assert.equal((await request("/api/leads?q="+encodeURIComponent("é".repeat(25)), {headers:auth})).status, 400);
  assert.equal((await request("/api/leads?cursor=malformed", {headers:auth})).status, 400);
  const downloaded = await request("/api/backup", { headers: auth });
  assert.equal(downloaded.status, 200);
  const backup = await downloaded.json();
  assert.equal(backup.leads.length, 1);
  const revision = (await (await request("/api/admin", {headers:auth})).json()).revision;
  const restored = await request("/api/admin", {method:"POST", headers:{
    ...auth, "content-type":"application/json", "x-ripees-admin":"1", origin:"https://"+host,
  },body:JSON.stringify({action:"restore",backup,revision})});
  assert.equal(restored.status, 200);
  const after = await request("/api/leads", {headers:auth});
  assert.equal((await after.json()).total, 1);
  assert.equal((await (await request("/api/chat")).json()).mode, "knowledge");
  await database.prepare(`WITH RECURSIVE fixture(n) AS (
    VALUES(1) UNION ALL SELECT n+1 FROM fixture WHERE n<4000
  ) INSERT INTO leads (id,name,email,phone,company,interest,message,created_at,updated_at)
    SELECT printf('00000000-0000-4000-8000-%012d',n),'Bulk fixture','bulk@example.test','','Bulk','Ecommerce',
      'Synthetic bulk fixture','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z' FROM fixture`).run();
  assert.equal((await request("/api/backup", {headers:auth})).status, 413);
  assert.equal((await request("/api/leads?format=csv", {headers:auth})).status, 413);
  const filtered = await request("/api/leads?format=csv&q=Synthetic", {headers:auth});
  assert.equal(filtered.status, 200);
  assert.match(await filtered.text(), /Synthetic contact/);
  console.log("PASS export bounds at 4,001 enquiries and filtered CSV remains available");
  console.log("PASS built Worker on local workerd: health, pages, favicon, signed owner access, denied bypass, enquiry idempotency, search, backup/restore and knowledge mode");
} finally {
  await runtime.dispose();
}
