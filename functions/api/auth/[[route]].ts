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

  // Canje del id_token de Google Sign-In por sesión del panel.
  // Responde SIEMPRE JSON: el caller es fetch() desde la página de login.
  app.post("/api/auth/google", async (c: any) => {
    const body = await c.req.json().catch(() => ({}));
    const credential = body?.credential;
    const jsonr = (data: Record<string, unknown>, status = 200, cookies: string[] = []): Response => {
      const h = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
      for (const ck of cookies) h.append("set-cookie", ck);
      return new Response(JSON.stringify(data), { status, headers: h });
    };
    if (!googleConfigurado(env)) {
      return jsonr({ ok: false, error: "Auth no configurado en el servidor (falta GOOGLE_CLIENT_ID / GOOGLE_WHITELIST)." }, 503);
    }
    if (typeof credential !== "string" || !credential) {
      return jsonr({ ok: false, error: "Falta el credential de Google." }, 400);
    }
    const user =
      env.MOCK_GOOGLE === "1" && typeof credential === "string" && credential.startsWith("mocktok_")
        ? perfilMock(credential)
        : await verificarIdToken(credential, env);
    if (!user) {
      return jsonr({ ok: false, error: "Google rechazó el token. Probá de nuevo." }, 403);
    }
    if (!emailAutorizado(user.email, env)) {
      return jsonr({ ok: false, error: `La cuenta ${user.email} no está en la whitelist del panel.` }, 403);
    }
    const ses = await crearSesion(db, user.email, user.sub);
    await limpiarVencidas(db);
    const destino = nextSeguro(body?.next);
    return jsonr({ ok: true, next: destino }, 200, [ses.cookie]);
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
