import assert from "node:assert/strict";
import { build } from "esbuild";
const bundled = await build({
  entryPoints: ["worker/index.ts"], bundle: true, write: false,
  platform: "node", format: "esm", define: { "import.meta.env.DEV": "false" },
  plugins: [{
    name: "handler-probe",
    setup(build) {
      build.onResolve({ filter: /access-owner$/ }, () => ({ path: "access", namespace: "fixture" }));
      build.onLoad({ filter: /^access$/, namespace: "fixture" }, () => ({
        contents: 'export async function verifyAccessOwner(value){return value==="verified-fixture"?{userId:"owner"}:null} export function withAccessOwner(_owner,run){return run()}',
      }));
      build.onResolve({ filter: /^vinext\/server\/fetch-handler$/ }, () => ({ path: "probe", namespace: "fixture" }));
      build.onLoad({ filter: /^probe$/, namespace: "fixture" }, () => ({
        contents: 'export default {fetch(){return new Response("handler", {headers:{"Cache-Control":"public"}})}}',
      }));
    },
  }],
});
const { default: worker } = await import("data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64"));
const env = { RIPEES_ADMIN_HOST: "ripees-staging.test" };
for (const path of ["/admin", "/admin/", "/api/admin", "/api/leads", "/api/backup", "/api/chat-insights"]) {
  const forged = new Request("https://direct-origin.test" + path, {
    headers: { "oai-authenticated-user-email": "owner@example.test" },
  });
  const denied = await worker.fetch(forged, env, {});
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("Cache-Control"), "private, no-store");
  const missingToken = await worker.fetch(new Request("https://ripees-staging.test" + path, {
    headers: { "oai-authenticated-user-email": "owner@example.test" },
  }), env, {});
  assert.equal(missingToken.status, 403);
  const response = await worker.fetch(new Request("https://ripees-staging.test" + path, {
    headers: { "cf-access-jwt-assertion": "verified-fixture" },
  }), env, {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
}
for (const path of ["/admin/login", "/api/admin-auth"]) {
  const response = await worker.fetch(new Request("https://ripees-staging.test" + path), env, {});
  assert.equal(response.status, 200);
}
assert.equal((await worker.fetch(new Request("https://direct-origin.test/website"), env, {})).status, 200);
console.log("PASS private paths deny alternate hosts and prevent public cache");
