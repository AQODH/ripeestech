import assert from "node:assert/strict";
import fs from "node:fs";
import { Miniflare } from "miniflare";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('synthetic D1 fixture'); } }",
  compatibilityDate: "2026-05-15",
  d1Databases: { DB: "ripees-remediation-fixture" },
});

try {
  const db = await runtime.getD1Database("DB");
  for (const file of fs.readdirSync("drizzle").filter(name => name.endsWith(".sql")).sort()) {
    const sql = fs.readFileSync("drizzle/" + file, "utf8");
    await db.batch(sql.split("--> statement-breakpoint").filter(part => part.trim()).map(part => db.prepare(part)));
  }
  const tables = await db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all();
  for (const name of ["site_content", "products", "leads", "chat_events", "chat_limits"]) {
    assert.ok(tables.results.some(row => row.name === name), name);
  }
  assert.equal(await db.prepare("SELECT 1 FROM site_content").first(), null);
  const row = db.prepare("INSERT INTO chat_limits(id,count,expires_at) VALUES (?,1,0)");
  await assert.rejects(db.batch([row.bind("rollback-fixture"), row.bind("rollback-fixture")]));
  assert.equal(await db.prepare("SELECT count FROM chat_limits WHERE id=?").bind("rollback-fixture").first(), null);
  const escaped = await db.prepare("SELECT '100%_東京' LIKE ? ESCAPE '\\' AS matched")
    .bind("%100\\%\\_東京%").first();
  assert.equal(escaped.matched, 1);
  console.log("PASS local workerd D1 migration order, empty-data safety, transactional rollback and Unicode literal search");
} finally {
  await runtime.dispose();
}
