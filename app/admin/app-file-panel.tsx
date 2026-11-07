"use client";
import { useState } from "react";
import { APP_FILE_ACCEPT, appFileInfo, downloadPath, formatBytes, type DownloadFields } from "../../lib/app-file-types";

type Props = {
  productId?: string;
  status: string;
  file: Partial<DownloadFields>;
  storage?: { connected: boolean; maxUploadMb: number };
  onChange: (fields: Partial<DownloadFields>) => void;
};

const empty: Partial<DownloadFields> = {
  app_version: "", download_key: "", download_name: "", download_size: 0, download_sha256: "", download_count: 0,
};

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

/** Owner-only panel inside the product editor for uploading the downloadable app file. */
export default function AppFilePanel({ productId, status, file, storage, onChange }: Props) {
  const [chosen, setChosen] = useState<File | null>(null);
  const [version, setVersion] = useState(file.app_version ?? "");
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const busy = progress !== null;
  const limit = (storage?.maxUploadMb ?? 95) * 1048576;

  function report(text: string, isError = false) { setMessage(text); setFailed(isError); }

  async function upload() {
    if (!productId || !chosen || busy) return;
    if (!appFileInfo(chosen.name)) return report("Choose an .apk, .ipa, .exe, .msi, .dmg, .AppImage, .deb or .zip file.", true);
    if (chosen.size > limit) return report("This file is larger than " + storage?.maxUploadMb + " MB.", true);
    setProgress(0); report("Checking the file…");
    try {
      const checksum = await sha256(chosen);
      report("Uploading…");
      const result = await new Promise<{ download?: DownloadFields; error?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/admin/upload?id=" + encodeURIComponent(productId));
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.setRequestHeader("X-Ripees-Admin", "1");
        xhr.setRequestHeader("X-File-Name", encodeURIComponent(chosen.name));
        xhr.setRequestHeader("X-File-Sha256", checksum);
        xhr.setRequestHeader("X-App-Version", encodeURIComponent(version.trim()));
        xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => {
          let body: { download?: DownloadFields; error?: string } = {};
          try { body = JSON.parse(xhr.responseText); } catch { /* non-JSON error page */ }
          if (xhr.status >= 200 && xhr.status < 300) resolve(body);
          else reject(new Error(body.error || "Upload failed (" + xhr.status + "). Please retry."));
        };
        xhr.onerror = () => reject(new Error("The connection dropped during upload. Please retry."));
        xhr.send(chosen);
      });
      if (result.download) onChange(result.download);
      setChosen(null);
      report("App file uploaded." + (status === "available" ? " It is now downloadable from the website." : " Set visibility to Available to offer it on the website."));
    } catch (error) {
      report(error instanceof Error ? error.message : "Upload failed. Please retry.", true);
    } finally {
      setProgress(null);
    }
  }

  async function remove() {
    if (!productId || busy || !confirm("Remove this app file? Visitors will no longer be able to download it.")) return;
    setProgress(0); report("Removing…");
    try {
      const r = await fetch("/api/admin/upload?id=" + encodeURIComponent(productId), { method: "DELETE", headers: { "X-Ripees-Admin": "1" } });
      const body = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(body.error || "Could not remove the file.");
      onChange(empty);
      report("App file removed.");
    } catch (error) {
      report(error instanceof Error ? error.message : "Could not remove the file.", true);
    } finally {
      setProgress(null);
    }
  }

  return (
    <fieldset className="app-file-panel">
      <legend>App download <small>Let visitors download this app directly, without Play Store or App Store</small></legend>
      {!productId ? <p className="help">Save the product first, then reopen it to attach the app file.</p>
        : storage && !storage.connected ? <p className="help">File storage is not connected yet. Add a Cloudflare R2 bucket bound as <code>BUCKET</code> to enable uploads.</p>
        : <>
          {file.download_name ? (
            <div className="app-file-current">
              <b>{file.download_name}</b>
              <span>{[file.app_version ? "Version " + file.app_version : "", formatBytes(file.download_size || 0), (file.download_count ?? 0) + " downloads"].filter(Boolean).join(" · ")}</span>
              <code title="SHA-256 checksum">{file.download_sha256}</code>
              {status === "available" && <a href={downloadPath(productId)} target="_blank" rel="noreferrer">Test download ↓</a>}
            </div>
          ) : <p className="help">No app file yet.</p>}
          <div className="field-grid">
            <label>{file.download_name ? "Replace with a new file" : "Choose app file"}
              <input type="file" accept={APP_FILE_ACCEPT} disabled={busy} onChange={e => { setChosen(e.target.files?.[0] ?? null); report(""); }} />
              <small>{"Up to " + (storage?.maxUploadMb ?? 95) + " MB · .apk for Android"}</small>
            </label>
            <label>Version label <small>Optional, e.g. 1.2.0</small>
              <input maxLength={40} value={version} disabled={busy} onChange={e => setVersion(e.target.value)} />
            </label>
          </div>
          {progress !== null && <progress max={100} value={progress} aria-label="Upload progress" />}
          {message && <p role={failed ? "alert" : "status"} className={"message " + (failed ? "error" : "success")}>{message}</p>}
          <div className="app-file-actions">
            <button type="button" disabled={!chosen || busy} onClick={upload}>{busy ? "Working…" : "Upload app file ↑"}</button>
            {file.download_name && <button type="button" className="danger-link" disabled={busy} onClick={remove}>Remove file</button>}
          </div>
        </>}
    </fieldset>
  );
}
