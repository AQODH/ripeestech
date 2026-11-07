import { env } from "cloudflare:workers";

// App files (APK, installers…) live in Cloudflare R2 under the `BUCKET` binding.
// The products table keeps only the object key and public facts about the file.

export * from "./app-file-types";

export function appBucket(): R2Bucket | null {
  return env.BUCKET ?? null;
}

/** Workers accept request bodies up to 100 MB on Free/Pro plans, so the default stays below that. */
export function maxUploadBytes(): number {
  const mb = Number(env.APP_MAX_UPLOAD_MB);
  return Math.round((Number.isFinite(mb) && mb >= 1 && mb <= 500 ? mb : 95) * 1024 * 1024);
}

