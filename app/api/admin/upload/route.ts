import { z } from "zod";
import { db, json, mutationAllowed, owner } from "../../../../lib/crm-server";
import { appBucket, appFileInfo, maxUploadBytes, safeFileName, type DownloadFields } from "../../../../lib/app-files";

export const dynamic = "force-dynamic";

const productId = z.string().uuid();
const NO_STORAGE = "File storage is not connected. Add a Cloudflare R2 bucket binding named BUCKET, then try again.";

async function authorise(req: Request) {
  const user = await owner();
  if (!user) return { error: json({ error: "Owner sign-in is required." }, 403) };
  if (!mutationAllowed(req) || req.headers.get("x-ripees-admin") !== "1") {
    return { error: json({ error: "Request was rejected." }, 403) };
  }
  const id = productId.safeParse(new URL(req.url).searchParams.get("id"));
  if (!id.success) return { error: json({ error: "Choose a saved product first." }, 400) };
  const bucket = appBucket();
  if (!bucket) return { error: json({ error: NO_STORAGE }, 503) };
  const product = await db().prepare("SELECT id,download_key FROM products WHERE id=?")
    .bind(id.data).first<{ id: string; download_key: string }>();
  if (!product) return { error: json({ error: "This product no longer exists. Reload the workspace." }, 404) };
  return { id: id.data, bucket, previousKey: product.download_key };
}

function header(req: Request, name: string) {
  try { return decodeURIComponent(req.headers.get(name) ?? "").trim(); }
  catch { return ""; }
}

/** Upload or replace the app file for one product. The body is the raw file. */
export async function POST(req: Request) {
  try {
    const auth = await authorise(req);
    if ("error" in auth) return auth.error;
    const name = safeFileName(header(req, "x-file-name"));
    if (!name) return json({ error: "Upload an .apk, .ipa, .exe, .msi, .dmg, .AppImage, .deb or .zip file." }, 400);
    const sha256 = (req.headers.get("x-file-sha256") ?? "").toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(sha256)) return json({ error: "The file checksum is missing. Please choose the file again." }, 400);
    const version = header(req, "x-app-version").slice(0, 40);
    const size = Number(req.headers.get("content-length"));
    const limit = maxUploadBytes();
    if (!Number.isSafeInteger(size) || size <= 0) return json({ error: "The file is empty or its size is unknown." }, 411);
    if (size > limit) return json({ error: "The file is larger than " + Math.round(limit / 1048576) + " MB." }, 413);
    if (!req.body) return json({ error: "The file is empty." }, 400);

    const key = "apps/" + auth.id + "/" + crypto.randomUUID() + "/" + name;
    const info = appFileInfo(name)!;
    try {
      // R2 recomputes SHA-256 and rejects the write if any byte changed on the way.
      await auth.bucket.put(key, req.body, {
        sha256,
        httpMetadata: { contentType: info.type, contentDisposition: 'attachment; filename="' + name + '"' },
        customMetadata: { productId: auth.id, version },
      });
    } catch (error) {
      console.error("App upload rejected by storage", error instanceof Error ? error.message : "unknown");
      return json({ error: "The file did not arrive intact. Please try the upload again." }, 400);
    }

    const now = new Date().toISOString();
    const fields: DownloadFields = {
      app_version: version, download_key: key, download_name: name, download_size: size,
      download_sha256: sha256, download_count: 0, download_updated_at: now,
    };
    try {
      const result = await db().prepare(
        "UPDATE products SET app_version=?,download_key=?,download_name=?,download_size=?,download_sha256=?,download_count=0,download_updated_at=? WHERE id=?",
      ).bind(version, key, name, size, sha256, now, auth.id).run();
      if (!result.meta.changes) throw new Error("Product disappeared");
    } catch (error) {
      await auth.bucket.delete(key).catch(() => {});
      throw error;
    }
    if (auth.previousKey && auth.previousKey !== key) await auth.bucket.delete(auth.previousKey).catch(() => {});
    return json({ ok: true, download: fields });
  } catch (error) {
    console.error("App upload failed", error instanceof Error ? error.name : "unknown");
    return json({ error: "The app file could not be saved. Your previous file is unchanged." }, 500);
  }
}

/** Remove the app file from a product. */
export async function DELETE(req: Request) {
  try {
    const auth = await authorise(req);
    if ("error" in auth) return auth.error;
    await db().prepare(
      "UPDATE products SET app_version='',download_key='',download_name='',download_size=0,download_sha256='',download_count=0,download_updated_at=? WHERE id=?",
    ).bind(new Date().toISOString(), auth.id).run();
    if (auth.previousKey) await auth.bucket.delete(auth.previousKey).catch(() => {});
    return json({ ok: true });
  } catch (error) {
    console.error("App file removal failed", error instanceof Error ? error.name : "unknown");
    return json({ error: "The app file could not be removed. Please retry." }, 500);
  }
}
