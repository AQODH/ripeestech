import { db, json } from "../../../lib/crm-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db().prepare("SELECT 1 FROM site_content LIMIT 1").first();
    return json({ status: "ok" });
  } catch {
    return json({ status: "unavailable" }, 503);
  }
}
