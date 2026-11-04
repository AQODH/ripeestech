import { verifyAccessOwner, withAccessOwner } from "../lib/access-owner";
import { getAdminSessionUser } from "../lib/admin-session";
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

const worker = {
  async scheduled(_event: unknown, env: Cloudflare.Env) {
    if(!env.DB)throw new Error('Scheduled retention requires DB');
    await env.DB.prepare('DELETE FROM chat_events WHERE created_at < ?').bind(new Date(Date.now()-30*86400000).toISOString()).run();
  },
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const url = new URL(request.url);
    let decodedPath: string;
    try { decodedPath = decodeURIComponent(url.pathname); }
    catch { return new Response("Invalid URL.", { status: 400 }); }
    const path = decodedPath.replace(/\/+/g, "/").replace(/\/+$/, "");
    const privateRoute = /^\/(?:admin(?:\/|$)|api\/(?:admin(?:-auth)?|leads|backup|chat-insights)(?:\/|$))/i.test(path);
    const authEntry = path === "/admin/login" || path === "/api/admin-auth";
    const privateHeaders = {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    };
    if (privateRoute && (!env.RIPEES_ADMIN_HOST || url.hostname !== env.RIPEES_ADMIN_HOST)) {
      return new Response("Owner workspace unavailable on this host.", { status: 403, headers: privateHeaders });
    }
    const accessOwner = privateRoute ? await verifyAccessOwner(request.headers.get("cf-access-jwt-assertion"), env) : null;
    const sessionOwner = privateRoute && !authEntry && !accessOwner
      ? await getAdminSessionUser(request.headers, env.DB, env.RIPEES_ADMIN_EMAILS)
      : null;
    if (privateRoute && !authEntry && !accessOwner && !sessionOwner) {
      return new Response("Owner sign-in is required.", { status: 403, headers: privateHeaders });
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    const handle = () => runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
    const response = await (accessOwner ? withAccessOwner(accessOwner, handle) : handle());
    if (!privateRoute) return response;
    const secured = new Response(response.body, response);
    for (const [name, value] of Object.entries(privateHeaders)) secured.headers.set(name, value);
    return secured;
  },
};

export default worker;
