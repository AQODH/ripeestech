import type { LeadRecord, ProductRecord } from "../../../lib/models";
import { owner, json, readContent, db, noCache } from "../../../lib/crm-server";
import { checkExportCount, EXPORT_LIMIT, pagedExport } from "../../../lib/crm-transfer";
import { requestFailure } from "../../../lib/requests";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!await owner()) return json({ error: "Owner sign-in is required." }, 403);
    const database = db();
    const count = await database.prepare("SELECT COUNT(*) AS count FROM (SELECT 1 FROM leads LIMIT ?)")
      .bind(EXPORT_LIMIT + 1).first<{ count: number }>();
    checkExportCount(Number(count?.count || 0));
    const content = await readContent();
    const { results: products } = await database.prepare(
      "SELECT * FROM products ORDER BY sort_order ASC, created_at DESC LIMIT 1001",
    ).all<ProductRecord>();
    if (products.length > 1000) return json({ error: "Use an authorized D1 export for this catalogue." }, 413);
    const head = JSON.stringify({
      format: "ripees-crm", version: 1, exportedAt: new Date().toISOString(),
      settings: content.settings, products,
    });
    const stream = pagedExport<LeadRecord>(
      head.slice(0, -1) + ',"leads":[',
      "]}",
      async (after, size) => {
        const where = after ? " WHERE created_at < ? OR (created_at=? AND id<?)" : "";
        const args = after ? [after.created_at, after.created_at, after.id, size] : [size];
        const { results } = await database.prepare(
          "SELECT id,name,email,phone,company,interest,message,status,notes,created_at,updated_at FROM leads" +
          where + " ORDER BY created_at DESC,id DESC LIMIT ?",
        ).bind(...args).all<LeadRecord>();
        return results;
      },
      (rows, first) => (first ? "" : ",") + JSON.stringify(rows).slice(1, -1),
    );
    return new Response(stream, { headers: {
      ...noCache, "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ripees-backup.json"',
    } });
  } catch (error) {
    return requestFailure(error) ?? json({ error: "Could not export a backup. Please retry." }, 503);
  }
}
