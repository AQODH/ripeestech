import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
if (fs.existsSync(".dev.vars")) process.loadEnvFile(".dev.vars");

const [mode, rawEmail, ...args] = process.argv.slice(2);
if (!["--local", "--remote"].includes(mode) || !rawEmail) {
  throw new Error(
    "Usage: node scripts/provision-admin.mjs --local admin@example.com [--base-url http://127.0.0.1:4173] | --remote admin@example.com --database-id <D1-id> --base-url https://admin.example.com",
  );
}

const options = new Map();
for (let index = 0; index < args.length; index += 2) {
  if (!["--base-url", "--database-id"].includes(args[index]) || !args[index + 1] || options.has(args[index])) {
    throw new Error(`Invalid option: ${args[index] ?? ""}`);
  }
  options.set(args[index], args[index + 1]);
}
if (mode === "--local" && options.has("--database-id")) {
  throw new Error("--database-id is only used for remote D1 provisioning.");
}
const email = rawEmail.trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
  throw new Error("Provide a valid administrator email address.");
}
const allowed = new Set(
  (process.env.RIPEES_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);
if (!allowed.has(email)) {
  throw new Error("Add the address to RIPEES_ADMIN_EMAILS before provisioning it.");
}
const pepper = process.env.RIPEES_AUTH_PEPPER;
if (!pepper || pepper.length < 32) {
  throw new Error("Set RIPEES_AUTH_PEPPER to a stable random secret of at least 32 characters.");
}

const baseUrl = options.get("--base-url") ??
  (mode === "--local" ? `http://127.0.0.1:${process.env.PORT || 4173}` : "");
let parsedBase;
try {
  parsedBase = new URL(baseUrl);
} catch {
  throw new Error("Provide --base-url with the local or hosted admin origin.");
}
if (
  (mode === "--remote" && parsedBase.protocol !== "https:") ||
  !["http:", "https:"].includes(parsedBase.protocol) ||
  parsedBase.username ||
  parsedBase.password ||
  parsedBase.search ||
  parsedBase.hash ||
  parsedBase.pathname !== "/" ||
  (mode === "--local" && !["127.0.0.1", "localhost"].includes(parsedBase.hostname))
) {
  throw new Error("Remote setup links require a clean HTTPS base URL.");
}

const token = randomBytes(32).toString("hex");
const tokenHash = createHmac("sha256", pepper).update(`setup:${token}`).digest("hex");
const expiresAt = Date.now() + 30 * 60 * 1000;
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const sql = [
  `UPDATE admin_setup_tokens SET used_at=${Date.now()} WHERE email=${quote(email)} AND used_at IS NULL`,
  `INSERT INTO admin_setup_tokens (id,email,token_hash,expires_at) VALUES (${quote(randomUUID())},${quote(email)},${quote(tokenHash)},${expiresAt})`,
].join(";\n");

if (mode === "--local") {
  const databasePath = path.join(root, ".local", "ripees.sqlite");
  if (!fs.existsSync(databasePath)) {
    throw new Error("Local database is not initialized. Start `npm run local` once, then retry.");
  }
  const sqlite = new DatabaseSync(databasePath);
  sqlite.exec("PRAGMA busy_timeout=5000");
  try {
    sqlite.exec("BEGIN");
    sqlite.exec(sql);
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  } finally {
    sqlite.close();
  }
} else {
  const hosting = JSON.parse(fs.readFileSync(path.join(root, ".openai", "hosting.json"), "utf8"));
  if (typeof hosting.d1 !== "string" || !hosting.d1) {
    throw new Error("A D1 database binding is required in .openai/hosting.json.");
  }
  const databaseId = options.get("--database-id");
  if (!databaseId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId)) {
    throw new Error("Remote provisioning requires --database-id with the D1 database UUID.");
  }
  const configPath = path.join(root, "dist", "server", "wrangler.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const binding = config.d1_databases?.find((entry) => entry.binding === hosting.d1);
  if (!binding) throw new Error(`The built Wrangler config has no D1 binding named ${hosting.d1}.`);
  binding.database_id = databaseId;
  const require = createRequire(path.join(root, "package.json"));
  const wrangler = require.resolve("wrangler/bin/wrangler.js");
  const sqlFile = path.join(os.tmpdir(), `ripees-admin-${randomUUID()}.sql`);
  const temporaryConfig = path.join(path.dirname(configPath), `wrangler.admin-${randomUUID()}.json`);
  try {
    fs.writeFileSync(sqlFile, sql, { mode: 0o600 });
    fs.writeFileSync(temporaryConfig, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    const result = spawnSync(
      process.execPath,
      [
        wrangler,
        "d1",
        "execute",
        hosting.d1,
        "--remote",
        "--config", temporaryConfig,
        "--file",
        sqlFile,
      ],
      { cwd: root, stdio: "inherit" },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Wrangler provisioning failed with status ${result.status}.`);
  } finally {
    fs.rmSync(sqlFile, { force: true });
    fs.rmSync(temporaryConfig, { force: true });
  }
}

parsedBase.pathname = `${parsedBase.pathname.replace(/\/+$/, "")}/admin/login`;
parsedBase.search = "";
parsedBase.hash = `setup=${token}`;
console.log(`Setup link for ${email} (expires in 30 minutes):`);
console.log(parsedBase.toString());
console.log("Share this link with the administrator through a private channel. Do not post or email it publicly.");
