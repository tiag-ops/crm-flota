// Sesiones del panel: cookie HttpOnly + fila en D1 (hash del token, nunca el token crudo).
export const SESSION_COOKIE = "crm_session";
export const SESSION_TTL_DIAS = 14;

export function randomToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function sha256hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
}

export function getCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export type Sesion = { email: string; sub: string };

/** Valida el token crudo de la cookie contra D1. null = sesión inexistente/expirada. */
export async function sesionActiva(db: any, raw: string | undefined): Promise<Sesion | null> {
  if (!raw) return null;
  const hash = await sha256hex(raw);
  const row = (
    await db
      .prepare(
        `SELECT s.email, s.sub FROM sesiones s
         WHERE s.token_hash = ? AND s.expires_at > datetime('now')`
      )
      .bind(hash)
      .first()
  ) as any;
  if (!row) return null;
  return { email: row.email, sub: row.sub };
}

/** Borra sesiones vencidas (barato, tabla chica). Llamar tras validar. */
export async function limpiarVencidas(db: any): Promise<void> {
  await db.prepare("DELETE FROM sesiones WHERE expires_at <= datetime('now')").run();
}

export async function crearSesion(
  db: any,
  email: string,
  sub: string
): Promise<{ raw: string; cookie: string }> {
  const raw = randomToken();
  await db
    .prepare(
      `INSERT INTO sesiones (token_hash, email, sub, created_at, expires_at)
       VALUES (?, ?, ?, datetime('now'), datetime('now', '+${SESSION_TTL_DIAS} days'))`
    )
    .bind(await sha256hex(raw), email, sub)
    .run();
  return {
    raw,
    cookie: `${SESSION_COOKIE}=${raw}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_DIAS * 86400}`,
  };
}

export function cookieLogout(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
