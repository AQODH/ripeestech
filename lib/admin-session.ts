export const ADMIN_SESSION_COOKIE = "ripees_admin_session";

export type AdminSessionUser = {
  userId: string;
  email: string;
  displayName: string;
  fullName: string | null;
};

function cookieValue(requestHeaders: Headers): string | null {
  for (const part of (requestHeaders.get("cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === ADMIN_SESSION_COOKIE) return value.join("=") || null;
  }
  return null;
}

function allowedEmails(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function getAdminSessionUser(
  requestHeaders: Headers,
  database: D1Database | undefined,
  allowlist: string | undefined,
): Promise<AdminSessionUser | null> {
  const token = cookieValue(requestHeaders);
  if (!database || !token || token.length !== 64 || !/^[0-9a-f]+$/.test(token)) return null;

  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
  );
  const tokenHash = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const row = await database
    .prepare(
      "SELECT admin_users.id,admin_users.email FROM admin_sessions JOIN admin_users ON admin_users.id=admin_sessions.user_id WHERE admin_sessions.token_hash=? AND admin_sessions.expires_at>? LIMIT 1",
    )
    .bind(tokenHash, Date.now())
    .first<{ id: string; email: string }>();

  if (!row || !allowedEmails(allowlist).has(row.email.toLowerCase())) return null;
  return { userId: row.id, email: row.email, displayName: row.email, fullName: null };
}
