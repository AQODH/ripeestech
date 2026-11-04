"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";

type AuthResponse = {
  error?: string;
  email?: string;
  recoveryCodes?: string[];
  redirectTo?: string;
};

const fieldStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  border: "1px solid #c9d2c8",
  borderRadius: 8,
  font: "inherit",
};

export default function AdminLoginPage() {
  const [mode, setMode] = useState<"login" | "setup" | "recovery">("login");
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const setupToken = fragment.get("setup");
      if (!setupToken) return;
      setToken(setupToken);
      setMode("setup");
      window.history.replaceState(null, "", window.location.pathname);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (mode !== "login" && password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const action = mode === "setup"
        ? { action: "complete-setup", token, password }
        : mode === "recovery"
          ? { action: "reset-password", email, recoveryCode, password }
          : { action: "login", email, password };
      const response = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const result = await response.json() as AuthResponse;
      if (!response.ok) throw new Error(result.error || "Authentication failed. Please retry.");
      if (mode === "login") {
        // A full navigation keeps this page independent from framework-specific router runtime.
        window.location.assign(result.redirectTo || "/admin");
      } else {
        if (result.email) setEmail(result.email);
        setRecoveryCodes(result.recoveryCodes || []);
        setPassword("");
        setConfirmation("");
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  async function copyRecoveryCodes() {
    if (!recoveryCodes) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      setError("");
    } catch {
      setError("Copy was unavailable. Select and copy the codes manually.");
    }
  }

  const title = mode === "setup" ? "Choose your password" : mode === "recovery" ? "Reset your password" : "Administrator sign in";

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f5f7f1", color: "#20382c", fontFamily: "system-ui, sans-serif" }}>
      <section style={{ width: "100%", maxWidth: 430, padding: 32, background: "white", border: "1px solid #e1e7de", borderRadius: 16, boxShadow: "0 16px 48px #20382c12" }}>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" aria-label="RIPEES home" style={{ color: "#20382c", fontWeight: 800, letterSpacing: 2, textDecoration: "none" }}>RIPEES</a>
        <h1 style={{ margin: "24px 0 8px", fontSize: 28 }}>{recoveryCodes ? "Save your recovery codes" : title}</h1>
        {recoveryCodes ? (
          <>
            <p>These codes can each be used once to reset your password. Save them somewhere private; they will not be shown again.</p>
            <ol aria-label="Recovery codes" style={{ padding: 16, background: "#f5f7f1", borderRadius: 8, overflowWrap: "anywhere", lineHeight: 1.8 }}>
              {recoveryCodes.map((code) => <li key={code}><code>{code}</code></li>)}
            </ol>
            {error && <p role="alert" style={{ color: "#a32828" }}>{error}</p>}
            <button type="button" onClick={copyRecoveryCodes} style={buttonStyle}>Copy codes</button>
            <button type="button" onClick={() => { setRecoveryCodes(null); setMode("login"); setToken(""); }} style={{ ...buttonStyle, marginTop: 10, background: "#20382c" }}>Continue to sign in</button>
          </>
        ) : (
          <>
            <p style={{ color: "#5e6f62", lineHeight: 1.6 }}>
              {mode === "login" ? "Sign in to the RIPEES administrator workspace." : mode === "setup" ? "Create a password for your administrator account. Setup links expire after 30 minutes and work once." : "Use one of your saved recovery codes to choose a new password."}
            </p>
            <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
              {mode !== "setup" && <label style={labelStyle}>Administrator email
                <input autoComplete="username" type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} style={fieldStyle} />
              </label>}
              {mode === "recovery" && <label style={labelStyle}>Recovery code
                <input autoComplete="off" required value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} style={fieldStyle} />
              </label>}
              <label style={labelStyle}>Password
                <input autoComplete={mode === "login" ? "current-password" : "new-password"} type={showPassword ? "text" : "password"} required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} style={fieldStyle} />
              </label>
              {mode !== "login" && <label style={labelStyle}>Confirm password
                <input autoComplete="new-password" type={showPassword ? "text" : "password"} required minLength={12} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} style={fieldStyle} />
              </label>}
              <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#5e6f62", fontSize: 14 }}>
                <input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
                Show password
              </label>
              {error && <p role="alert" style={{ margin: 0, color: "#a32828" }}>{error}</p>}
              <button type="submit" disabled={busy} style={{ ...buttonStyle, opacity: busy ? 0.65 : 1 }}>
                {busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "setup" ? "Save password" : "Reset password"}
              </button>
            </form>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22, fontSize: 14 }}>
              {mode === "login" ? <button type="button" onClick={() => { setMode("recovery"); setError(""); }} style={linkStyle}>Use a recovery code</button> : <button type="button" onClick={() => { setMode("login"); setError(""); }} style={linkStyle}>Back to sign in</button>}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/website" style={{ color: "#537932" }}>View website</a>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

const labelStyle: CSSProperties = { display: "grid", gap: 7, fontSize: 14, fontWeight: 600 };
const buttonStyle: CSSProperties = { width: "100%", padding: "13px 16px", border: 0, borderRadius: 8, background: "#537932", color: "white", font: "inherit", fontWeight: 700, cursor: "pointer" };
const linkStyle: CSSProperties = { padding: 0, border: 0, background: "none", color: "#537932", font: "inherit", textDecoration: "underline", cursor: "pointer" };
