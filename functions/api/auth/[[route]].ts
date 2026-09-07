// Rutas OAuth GitHub del panel: /api/auth/{status,login,callback,logout}
import { Hono } from "hono";
import {
  crearSesion,
  getCookie,
  limpiarVencidas,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  sesionActiva,
} from "../../../src/lib/session";
import {
  githubConfigurado,
  intercambiarCodigo,
  usuarioGithub,
} from "../../../src/lib/gh-oauth";
import {
  autorizado,
  leerEstado,
  nextSeguro,
  payloadEstado,
  urlLogin,
} from "../../../src/lib/oauth-whitelist";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function DENEGADO(motivo: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Acceso denegado — CRM Flota</title><style>body{font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#09090b;color:#fafafa}main{text-align:center;max-width:440px;padding:2rem}h1{font-size:1.25rem}p{color:#a1a1aa;font-size:.9rem;line-height:1.5}</style></head><body><main><h1>Acceso denegado</h1><p>${esc(motivo)}</p><p><a href="/" style="color:#60a5fa">Volver al panel</a></p></main></body></html>`;
}

function pagina(html: string, cookies: string[], status = 200): Response {
  const h = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(html, { status, headers: h });
}

const LIMPIAR_STATE = `${OAUTH_STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

function redirect302(url: string, cookies: string[]): Response {
  const h = new Headers({ location: url, "cache-control": "no-store" });
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(null, { status: 302, headers: h });
}

export const onRequest = async (context: any): Promise<Response> => {
  const app = new Hono();
  const db = context.env.DB;
  const env = context.env;
  const origin = new URL(context.request.url).origin;

  // Estado de sesión para el frontend
  app.get("/api/auth/status", async (c: any) => {
    const ses = await sesionActiva(db, getCookie(c.req.header("Cookie"), SESSION_COOKIE));
    await limpiarVencidas(db);
    return Response.json(ses ? { logueado: true, login: ses.login } : { logueado: false });
  });

  // Botón "Iniciar sesión con GitHub"
  app.get("/api/auth/login", (c: any) => {
    if (!githubConfigurado(env)) {
      return pagina(
        DENEGADO(
          "OAuth no configurado en el servidor: faltan GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET."
        ),
        [],
        503
      );
    }
    const next = nextSeguro(new URL(c.req.url).searchParams.get("next"));
    const state = payloadEstado(next);
    return redirect302(urlLogin(origin, env.GITHUB_CLIENT_ID, state, env), [
      `${OAUTH_STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    ]);
  });

  // Vuelta de GitHub: code + state → sesión
  app.get("/api/auth/callback", async (c: any) => {
    const url = new URL(c.req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const stateCookie = getCookie(c.req.header("Cookie"), OAUTH_STATE_COOKIE);

    if (!code || !state || !stateCookie || state !== stateCookie) {
      return pagina(DENEGADO("State inválido o expirado. Volvé a intentar el login."), [LIMPIAR_STATE], 403);
    }
    const blanco = leerEstado(state);
    if (!blanco) {
      return pagina(DENEGADO("State corrupto. Volvé a intentar el login."), [LIMPIAR_STATE], 403);
    }
    if (!githubConfigurado(env)) {
      return pagina(DENEGADO("OAuth no configurado en el servidor."), [LIMPIAR_STATE], 503);
    }

    const token = await intercambiarCodigo(env, code, `${origin}/api/auth/callback`);
    if (!token) {
      return pagina(
        DENEGADO(
          "GitHub rechazó el intercambio del código (los code valen 10 minutos y un solo uso). Volvé a intentar."
        ),
        [LIMPIAR_STATE],
        403
      );
    }
    const gh = await usuarioGithub(token, env);
    if (!gh) {
      return pagina(DENEGADO("No pude leer tu usuario de GitHub con el token entregado."), [LIMPIAR_STATE], 403);
    }
    if (!autorizado(gh)) {
      return pagina(
        DENEGADO(`El usuario ${gh.login} no está en la whitelist del panel.`),
        [LIMPIAR_STATE],
        403
      );
    }

    const ses = await crearSesion(db, gh.login, gh.id);
    await limpiarVencidas(db);
    return redirect302(nextSeguro(blanco.next), [
      ses.cookie,
      LIMPIAR_STATE,
    ]);
  });

  // Cerrar sesión
  app.post("/api/auth/logout", async (c: any) => {
    const raw = getCookie(c.req.header("Cookie"), SESSION_COOKIE);
    if (raw) {
      const { sha256hex } = await import("../../../src/lib/session");
      await db.prepare("DELETE FROM sesiones WHERE token_hash = ?").bind(await sha256hex(raw)).run();
    }
    const h = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
    h.append(
      "set-cookie",
      `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
    );
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: h });
  });

  return app.fetch(context.request, context.env);
};
