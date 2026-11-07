// Built Worker + local R2: owner uploads an app file, visitors download it from the website.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { Miniflare } from "miniflare";

const directory = path.resolve("dist/server");
const config = JSON.parse(fs.readFileSync(path.join(directory, "wrangler.json"), "utf8"));
const entry = path.join(directory, config.main);
const modules = fs.readdirSync(directory, { recursive: true, withFileTypes: true })
  .filter(file => file.isFile() && /\.(?:m?js)$/.test(file.name))
  .map(file => path.join(file.parentPath, file.name))
  .filter(file => file !== entry);
const host = "ripees-staging.test";
const email = "owner@example.test";

function runtimeWith(withBucket) {
  return new Miniflare({
    modules: [entry, ...modules].map(file => ({ type: "ESModule", path: file })),
    modulesRoot: directory,
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags,
    d1Databases: { DB: "ripees-downloads-fixture-" + withBucket },
    ...(withBucket ? { r2Buckets: { BUCKET: "ripees-apps-fixture" } } : {}),
    bindings: {
      RIPEES_ADMIN_HOST: host, RIPEES_ADMIN_EMAILS: email, APP_MAX_UPLOAD_MB: "1",
      RIPEES_AUTH_PEPPER: "built-worker-test-pepper-with-at-least-32-characters", RIPEES_ENABLE_AI: "false",
    },
    outboundService: () => new Response("External requests disabled in this test.", { status: 502 }),
  });
}

async function prepare(runtime) {
  const database = await runtime.getD1Database("DB");
  for (const name of fs.readdirSync("drizzle").filter(file => file.endsWith(".sql")).sort()) {
    await database.batch(fs.readFileSync("drizzle/" + name, "utf8").split("--> statement-breakpoint")
      .filter(sql => sql.trim()).map(sql => database.prepare(sql)));
  }
  const token = "c".repeat(64);
  const hash = createHash("sha256").update(token).digest("hex");
  const now = new Date().toISOString();
  await database.prepare("INSERT INTO admin_users (id,email,password_hash,created_at,updated_at) VALUES (?,?,?,?,?)")
    .bind("owner", email, "unused", now, now).run();
  await database.prepare("INSERT INTO admin_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)")
    .bind(hash, "owner", now, Date.now() + 86400000).run();
  return { database, cookie: "ripees_admin_session=" + token };
}

const runtime = runtimeWith(true);
const bare = runtimeWith(false);
let passed = 0;
const pass = name => { passed++; console.log("PASS " + name); };
try {
  const { database, cookie } = await prepare(runtime);
  const request = (route, options = {}) => runtime.dispatchFetch("https://" + host + route, options);
  const admin = { cookie, origin: "https://" + host, "x-ripees-admin": "1" };

  const created = await request("/api/admin", { method: "POST", headers: { ...admin, "content-type": "application/json" },
    body: JSON.stringify({ action: "product", product: { name: "RIPEES Shop", summary: "Shop app", status: "available" } }) });
  assert.equal(created.status, 200, await created.clone().text());
  const workspace = await (await request("/api/admin", { headers: { cookie } })).json();
  assert.equal(workspace.fileStorage.connected, true);
  assert.equal(workspace.fileStorage.maxUploadMb, 1);
  const id = workspace.products[0].id;

  const apk = Buffer.alloc(300_000);
  for (let i = 0; i < apk.length; i++) apk[i] = (i * 31) % 251;
  const sha = createHash("sha256").update(apk).digest("hex");
  const upload = (extra = {}, body = apk, query = "?id=" + id) => request("/api/admin/upload" + query, {
    method: "POST", body,
    headers: { ...admin, "content-type": "application/octet-stream", "content-length": String(body.length),
      "x-file-name": encodeURIComponent("RIPEES Shop (beta).apk"), "x-file-sha256": sha, "x-app-version": "1.0.0", ...extra },
  });

  assert.equal((await upload({ cookie: "" })).status, 403);
  assert.equal((await upload({ "x-ripees-admin": "" })).status, 403);
  assert.equal((await upload({ origin: "https://evil.test" })).status, 403);
  pass("uploads require owner session, admin header and same origin");

  assert.equal((await upload({ "x-file-name": "virus.html" })).status, 400);
  assert.equal((await upload({ "x-file-sha256": "0".repeat(64) })).status, 400);
  assert.equal((await upload({}, Buffer.alloc(1_100_000))).status, 413);
  assert.equal((await upload({}, apk, "?id=not-a-uuid")).status, 400);
  pass("rejects wrong file types, corrupted uploads (checksum), oversize files and bad product IDs");

  const ok = await upload();
  assert.equal(ok.status, 200, await ok.clone().text());
  const { download } = await ok.json();
  assert.equal(download.download_name, "RIPEES-Shop-beta-.apk");
  assert.equal(download.download_size, apk.length);
  assert.equal(download.download_sha256, sha);
  pass("owner upload stores the file in R2 and records version, size and checksum");

  const page = await (await request("/website")).text();
  assert.match(page, new RegExp('href="/api/download\\?app=' + id + '"'));
  assert.match(page, /Download for Android/);
  assert.match(page, /Version 1\.0\.0 · 293 KB/);
  pass("website shows a download button with version and size");

  const file = await request("/api/download?app=" + id);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get("content-type"), "application/vnd.android.package-archive");
  assert.match(file.headers.get("content-disposition"), /attachment; filename="RIPEES-Shop-beta-\.apk"/);
  assert.equal(file.headers.get("x-checksum-sha256"), sha);
  assert.ok(Buffer.from(await file.arrayBuffer()).equals(apk));
  const part = await request("/api/download?app=" + id, { headers: { range: "bytes=1000-1999" } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get("content-range"), "bytes 1000-1999/" + apk.length);
  assert.ok(Buffer.from(await part.arrayBuffer()).equals(apk.subarray(1000, 2000)));
  assert.equal((await request("/api/download?app=" + id, { method: "HEAD" })).status, 200);
  const count = await database.prepare("SELECT download_count FROM products WHERE id=?").bind(id).first();
  assert.equal(count.download_count, 1);
  pass("public download streams the exact bytes, supports resume (Range) and counts fresh downloads only");

  await database.prepare("UPDATE products SET status='draft' WHERE id=?").bind(id).run();
  assert.equal((await request("/api/download?app=" + id)).status, 404);
  await database.prepare("UPDATE products SET status='available' WHERE id=?").bind(id).run();
  assert.equal((await request("/api/download?app=00000000-0000-4000-8000-000000000000")).status, 404);
  pass("draft products and unknown IDs are not downloadable");

  const bucket = await runtime.getR2Bucket("BUCKET");
  const firstKey = download.download_key;
  const replaced = await (await upload({ "x-app-version": "1.1.0" })).json();
  assert.notEqual(replaced.download.download_key, firstKey);
  assert.equal(await bucket.head(firstKey), null);
  pass("replacing the file removes the old version from storage");

  const removed = await request("/api/admin/upload?id=" + id, { method: "DELETE", headers: admin });
  assert.equal(removed.status, 200);
  assert.equal(await bucket.head(replaced.download.download_key), null);
  assert.equal((await request("/api/download?app=" + id)).status, 404);
  const third = await (await upload()).json();
  const deleted = await request("/api/admin", { method: "POST", headers: { ...admin, "content-type": "application/json" },
    body: JSON.stringify({ action: "deleteProduct", id }) });
  assert.equal(deleted.status, 200);
  assert.equal(await bucket.head(third.download.download_key), null);
  pass("removing the file or deleting the product also deletes the stored file");

  const backup = await (await request("/api/backup", { headers: { cookie } })).text();
  assert.doesNotThrow(() => JSON.parse(backup));
  pass("backup export still works with the new columns");

  const plain = await prepare(bare);
  const noStore = await bare.dispatchFetch("https://" + host + "/api/admin", { headers: { cookie: plain.cookie } });
  assert.equal((await noStore.json()).fileStorage.connected, false);
  assert.equal((await bare.dispatchFetch("https://" + host + "/api/download?app=" + id)).status, 503);
  pass("without an R2 bucket the site keeps working and uploads explain what to connect");

  console.log("\n" + passed + " app download checks passed against the built Worker with local R2.");
} finally {
  await runtime.dispose();
  await bare.dispose();
}
