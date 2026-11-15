import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const target = process.argv[2];
if (target !== "staging" && target !== "production") {
  throw new Error("Usage: node scripts/prepare-worker-config.mjs staging|production");
}

const root = fileURLToPath(new URL("../", import.meta.url));
if (fs.existsSync(path.join(root, ".env.local"))) process.loadEnvFile(path.join(root, ".env.local"));
if (fs.existsSync(path.join(root, ".dev.vars"))) process.loadEnvFile(path.join(root, ".dev.vars"));

const prefix = target === "staging" ? "RIPEES_STAGE_" : "RIPEES_PROD_";
const value = name => process.env[prefix + name]?.trim();
const databaseId = value("DATABASE_ID");
const otherId = process.env[target === "staging" ? "RIPEES_PROD_DATABASE_ID" : "RIPEES_STAGE_DATABASE_ID"];
const hostname = value("HOST");
const issuer = value("ACCESS_ISSUER");
const audience = value("ACCESS_AUDIENCE");
const email = value("ADMIN_EMAIL");
const emails = value("ADMIN_EMAILS") || process.env.RIPEES_ADMIN_EMAILS || email;
const pepper = value("AUTH_PEPPER") || process.env.RIPEES_AUTH_PEPPER;

if (!databaseId || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(databaseId) ||
    databaseId === "00000000-0000-0000-0000-000000000000" ||
    databaseId.toLowerCase() === otherId?.trim().toLowerCase()) {
  throw new Error("Provide a real, environment-specific D1 database ID.");
}
if (!hostname || (target === "staging"
  ? !/^ripees-staging\.[a-z0-9-]+\.workers\.dev$/.test(hostname)
  : hostname !== "ripees.com")) {
  throw new Error("Supply the intended staging Worker hostname or ripees.com for production.");
}
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error("Provide the authorized owner email.");
}
if (!pepper || pepper.length < 32) {
  throw new Error("Provide RIPEES_AUTH_PEPPER (at least 32 characters) in .env.local or via environment variable.");
}
if ((issuer || audience) &&
    (!issuer || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) ||
     !audience || !/^[a-f\d]{64}$/i.test(audience))) {
  throw new Error("Provide both a valid Cloudflare Access issuer and application audience.");
}

const directory = path.join(root, "dist", "server");
const built = JSON.parse(fs.readFileSync(path.join(directory, "wrangler.json"), "utf8"));
const migrations = path.join(root, "drizzle");
if (!fs.existsSync(path.join(migrations, "0004_company_contacts.sql"))) {
  throw new Error("Expected reviewed Drizzle migrations in the source checkout.");
}
if (!built.main || !fs.existsSync(path.resolve(directory, built.main)) || !built.assets?.directory) {
  throw new Error("Build the Worker before preparing its deployment config.");
}

const config = {
  name: "ripees-" + target,
  main: built.main,
  compatibility_date: built.compatibility_date,
  compatibility_flags: built.compatibility_flags,
  assets: built.assets,
  rules: built.rules,
  no_bundle: built.no_bundle,
  find_additional_modules: built.find_additional_modules,
  preserve_file_names: built.preserve_file_names,
  workers_dev: target === "staging",
  preview_urls: false,
  routes: target === "production" ? [
    { pattern: "ripees.com", custom_domain: true },
    { pattern: "www.ripees.com", custom_domain: true },
  ] : undefined,
  d1_databases: [{
    binding: "DB",
    database_name: "ripees-" + target,
    database_id: databaseId,
    migrations_dir: path.relative(directory, migrations).split(path.sep).join("/"),
  }],
  // App files (APK and installers) offered for direct download. Create the bucket first:
  //   wrangler r2 bucket create ripees-<target>-apps
  r2_buckets: [{ binding: "BUCKET", bucket_name: value("APPS_BUCKET") || "ripees-" + target + "-apps" }],
  triggers: { crons: ["17 2 * * *"] },
  observability: { enabled: true, head_sampling_rate: 0.1 },
  vars: {
    RIPEES_ADMIN_HOST: hostname,
    RIPEES_ADMIN_EMAIL: email,
    RIPEES_ADMIN_EMAILS: emails,
    RIPEES_AUTH_PEPPER: pepper,
    RIPEES_ENABLE_AI: "false",
    APP_MAX_UPLOAD_MB: value("APP_MAX_UPLOAD_MB") || "95",
  },
};
if (issuer && audience) {
  config.vars.RIPEES_ACCESS_ISSUER = issuer;
  config.vars.RIPEES_ACCESS_AUDIENCE = audience;
}
const output = path.join(directory, "wrangler." + target + ".json");
fs.writeFileSync(output, JSON.stringify(config, null, 2) + "\n");
console.log("Prepared dist/server/wrangler." + target + ".json. No cloud resources were contacted.");
