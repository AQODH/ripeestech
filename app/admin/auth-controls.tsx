"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink, LogOut, RefreshCw, Settings, ShieldCheck } from "lucide-react";

type Props = {
  ownerName?: string;
  onRefresh?: () => void;
  onSettings?: () => void;
  canSignOut?: () => boolean;
};

export default function AdminAuthControls({ ownerName = "RIPEES administrator", onRefresh, onSettings, canSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const name = ownerName.trim() || "RIPEES administrator";
  const initials = name.includes("@") ? name.slice(0, 2).toUpperCase() : name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

  useEffect(() => {
    if (!open) return;
    container.current?.querySelector<HTMLButtonElement>(".profile-action")?.focus();
    function dismiss(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  function select(action?: () => void) {
    setOpen(false);
    trigger.current?.focus();
    action?.();
  }

  async function signOut() {
    if (canSignOut && !canSignOut()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!response.ok) throw new Error("Could not sign out. Please retry.");
      window.location.replace(new URL("/admin/login", window.location.origin).href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out. Please retry.");
      setBusy(false);
    }
  }

  return (
    <div className="profile" ref={container} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button ref={trigger} type="button" className="profile-trigger" aria-expanded={open} aria-controls="profile-panel" aria-label={"Account options for " + name} onClick={() => setOpen(!open)}>
        <span className="profile-avatar" aria-hidden="true">{initials}</span>
        <span className="profile-label"><strong>My workspace</strong><small>Administrator</small></span>
        <ChevronDown size={15} className={open ? "profile-chevron is-open" : "profile-chevron"} aria-hidden="true" />
      </button>
      {open && (
        <div id="profile-panel" className="profile-panel" role="region" aria-label="Your account">
          <div className="profile-identity">
            <span className="profile-avatar profile-avatar-large" aria-hidden="true">{initials}</span>
            <div><strong>{name}</strong><span>RIPEES Technologies</span><small><ShieldCheck size={12} aria-hidden="true" /> Administrator access</small></div>
          </div>
          <div className="profile-actions">
            <button type="button" className="profile-action" onClick={() => select(onSettings)}><Settings size={17} aria-hidden="true" /><span>Workspace settings</span></button>
            <button type="button" className="profile-action" onClick={() => select(onRefresh)}><RefreshCw size={17} aria-hidden="true" /><span>Refresh workspace</span></button>
            <a className="profile-action" href="/website" onClick={() => setOpen(false)}><ExternalLink size={17} aria-hidden="true" /><span>View website</span><span className="profile-link-hint" aria-hidden="true">↗</span></a>
          </div>
          <div className="profile-bottom">
            {error && <p role="alert" className="profile-error">{error}</p>}
            <button type="button" className="profile-action profile-signout" disabled={busy} onClick={signOut}><LogOut size={17} aria-hidden="true" /><span>{busy ? "Signing out…" : "Sign out"}</span></button>
          </div>
        </div>
      )}
    </div>
  );
}
