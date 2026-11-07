// Browser-safe facts about downloadable app files (shared by the website, API and admin workspace).

export const APP_FILE_TYPES: Record<string, { type: string; platform: string }> = {
  ".apk": { type: "application/vnd.android.package-archive", platform: "Android" },
  ".ipa": { type: "application/octet-stream", platform: "iPhone / iPad" },
  ".exe": { type: "application/vnd.microsoft.portable-executable", platform: "Windows" },
  ".msi": { type: "application/x-msi", platform: "Windows" },
  ".dmg": { type: "application/x-apple-diskimage", platform: "macOS" },
  ".appimage": { type: "application/octet-stream", platform: "Linux" },
  ".deb": { type: "application/vnd.debian.binary-package", platform: "Linux" },
  ".zip": { type: "application/zip", platform: "your device" },
};

export const APP_FILE_ACCEPT = Object.keys(APP_FILE_TYPES).join(",");

export type DownloadFields = {
  app_version: string;
  download_key: string;
  download_name: string;
  download_size: number;
  download_sha256: string;
  download_count: number;
  download_updated_at: string;
};

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

export function appFileInfo(name: string) {
  return APP_FILE_TYPES[extensionOf(name)] ?? null;
}

/** Keeps only safe ASCII characters so the name works in URLs, R2 keys and headers. */
export function safeFileName(raw: string): string | null {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const cleaned = base.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-")
    .replace(/^[-.]+/, "").slice(-120);
  return cleaned && appFileInfo(cleaned) ? cleaned : null;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function downloadPath(productId: string): string {
  return "/api/download?app=" + encodeURIComponent(productId);
}
