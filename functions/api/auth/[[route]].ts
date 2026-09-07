// Rutas de auth Google: /api/auth/{status,google,logout}.
// /api/auth/google canjea el id_token de GIS por sesión (cookie HttpOnly + D1).
import { Hono } from "hono";
import {
  getCookie,
  sesionActiva,
  limpiarVencidas,
  crearSesion,
  cookieLogout,
  SESSION_COOKIE,
} from "../../../src/lib/session";
import { verificarIdToken, emailAutorizado, googleConfigurado } from "../../../src/lib/goauth";
import { nextSeguro } from "../../../src/lib/oauth-whitelist";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function DENEGADO(motivo: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Acceso denegado — CRM Flota</title><style>body{font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#09090b;color:#fafafa}main{text-align:center;max-width:440px;padding:2rem}h1{font-size:1.25rem}p{color:#a1a1aa;font-size:.9rem;line-height:1.5}</style></head><body><main><h1>Acceso denegado</h1><p>${esc(motivo)}</p><p><a href="/login" style="color:#60a5fa">Volver a intentar</a></p></main></body></html>`;
}

function pagina(html: string, cookies: string[], status = 200): Response {
  const h = new Headers({ "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(html, { status, headers: h });
}

/** SOLO E2E (binding MOCK_GOOGLE=1, inerte en prod): decodifica mocktok_<b64(email)>. */
function perfilMock(credential: string): { sub: string; email: string } | null {
  try {
    const email = atob(credential.slice("mocktok_".length)).toLowerCase();
    return email.includes("@") ? { sub: "1234567890", email } : null;
  } catch {
    return null;
  }
}

export const onRequest = async (context: any): Promise<Response> => {
  const app = new Hono();
  const db = context.env.DB;
  const env = context.env;

  // Estado de sesión para UIs
  app.get("/api/auth/status", async (c: any) => {
    const ses = await sesionActiva(db, getCookie(c.req.header("Cookie"), SESSION_COOKIE));
    return Response.json(ses ? { logueado: true, email: ses.email } : { logueado: false });
  });

  // Canje del id_token de Google Sign-In por sesión del panel
  app.post("/api/auth/google", async (c: any) => {
    const body = await c.req.json().catch(() => ({}));
    const credential = body?.credential;
    if (!googleConfigurado(env)) {
      return pagina(DENEGADO("Auth no configurado en el servidor (falta GOOGLE_CLIENT_ID / GOOGLE_WHITELIST)."), [], 503);
    }
    if (typeof credential !== "string" || !credential) {
      return pagina(DENEGADO("Falta el credential de Google."), [], 400);
    }
    const user =
      env.MOCK_GOOGLE === "1" && typeof credential === "string" && credential.startsWith("mocktok_")
        ? perfilMock(credential)
        : await verificarIdToken(credential, env);
    if (!user) {
      return pagina(DENEGADO("Google rechazó el token (puede estar vencido). Probá de nuevo."), [], 403);
    }
    if (!emailAutorizado(user.email, env)) {
      return pagina(DENEGADO(`La cuenta ${user.email} no está en la whitelist del panel.`), [], 403);
    }
    const ses = await crearSesion(db, user.email, user.sub);
    await limpiarVencidas(db);
    const h = new Headers({ location: nextSeguro(body?.next), "cache-control": "no-store" });
    h.append("set-cookie", ses.cookie);
    return new Response(null, { status: 302, headers: h });
  });

  // Cerrar sesión
  app.post("/api/auth/logout", async (c: any) => {
    const raw = getCookie(c.req.header("Cookie"), SESSION_COOKIE);
    if (raw) {
      const { sha256hex } = await import("../../../src/lib/session");
      await db.prepare("DELETE FROM sesiones WHERE token_hash = ?").bind(await sha256hex(raw)).run();
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json", "set-cookie": cookieLogout() },
    });
  });

  return app.fetch(context.request, context.env);
};
