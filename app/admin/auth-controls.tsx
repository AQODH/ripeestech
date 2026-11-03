"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminAuthControls() {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (pathname === "/admin/login") return null;

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!response.ok) throw new Error("Could not sign out. Please retry.");
      router.replace("/admin/login");
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Could not sign out. Please retry.");
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "fixed", zIndex: 100, top: 16, right: 20, display: "flex", alignItems: "center", gap: 10 }}>
      {error && <span role="alert" style={{ padding: "8px 10px", background: "white", color: "#a32828", borderRadius: 6, font: "13px system-ui, sans-serif" }}>{error}</span>}
      <button type="button" onClick={signOut} disabled={busy} style={{ padding: "9px 13px", border: "1px solid #c9d2c8", borderRadius: 7, background: "white", color: "#20382c", font: "600 13px system-ui, sans-serif", cursor: "pointer" }}>
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
