import { z } from "zod";
import { db, noCache } from "../../../lib/crm-server";
import { appBucket, appFileInfo } from "../../../lib/app-files";

export const dynamic = "force-dynamic";

type Row = { id: string; download_key: string; download_name: string; download_sha256: string };

function text(message: string, status: number) {
  return new Response(message, { status, headers: { ...noCache, "Content-Type": "text/plain; charset=utf-8" } });
}

async function serve(req: Request, withBody: boolean) {
  const id = z.string().uuid().safeParse(new URL(req.url).searchParams.get("app"));
  if (!id.success) return text("Download not found.", 404);
  const bucket = appBucket();
  if (!bucket) return text("Downloads are temporarily unavailable.", 503);
  const row = await db().prepare(
    "SELECT id,download_key,download_name,download_sha256 FROM products WHERE id=? AND status='available' AND download_key<>''",
  ).bind(id.data).first<Row>();
  if (!row) return text("Download not found.", 404);

  const range = req.headers.get("range");
  let object: R2Object | R2ObjectBody | null;
  try {
    object = withBody
      ? await bucket.get(row.download_key, range ? { range: req.headers } : undefined)
      : await bucket.head(row.download_key);
  } catch (error) {
    if (range) return text("The requested range is not available.", 416);
    throw error;
  }
  if (!object) return text("Download not found.", 404);

  const headers = new Headers({
    "Content-Type": appFileInfo(row.download_name)?.type ?? "application/octet-stream",
    "Content-Disposition": 'attachment; filename="' + row.download_name + '"',
    "Cache-Control": "public, max-age=300",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "ETag": object.httpEtag,
    "X-Checksum-SHA256": row.download_sha256,
  });
  let status = 200;
  let start = 0;
  let length = object.size;
  const r = "range" in object ? object.range as R2Range | undefined : undefined;
  if (range && r) {
    if ("suffix" in r && r.suffix !== undefined) { length = Math.min(r.suffix, object.size); start = object.size - length; }
    else { start = ("offset" in r && r.offset) || 0; length = ("length" in r && r.length !== undefined) ? r.length : object.size - start; }
    status = 206;
    headers.set("Content-Range", "bytes " + start + "-" + (start + length - 1) + "/" + object.size);
  }
  headers.set("Content-Length", String(length));

  // Count a download once per fresh start, not once per resumed chunk.
  if (withBody && start === 0) {
    await db().prepare("UPDATE products SET download_count=download_count+1 WHERE id=?").bind(row.id).run();
  }
  const body = withBody && "body" in object ? (object as R2ObjectBody).body : null;
  return new Response(body, { status, headers });
}

export async function GET(req: Request) {
  try { return await serve(req, true); }
  catch (error) {
    console.error("App download failed", error instanceof Error ? error.name : "unknown");
    return text("The download could not start. Please try again.", 503);
  }
}

export async function HEAD(req: Request) {
  try { return await serve(req, false); }
  catch { return new Response(null, { status: 503, headers: noCache }); }
}
