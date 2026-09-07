// Candado global del CRM: TODO (páginas, assets, APIs) exige sesión de browser
// excepto: /api/auth/*, Bearer de máquina (pulse/deploys) y favicon.
// /login no existe como asset: la dibuja este middleware en el fallback.
import { getCookie, sesionActiva, SESSION_COOKIE } from "../src/lib/session";

const PUBLICOS = new Set(["/favicon.ico"]);

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paginaLogin(clientId: string | undefined, quiero: string): Response {
  const si = Boolean(clientId);
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ingresar — CRM Flota</title><style>body{font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#09090b;color:#fafafa}main{text-align:center;padding:2rem;max-width:420px}h1{font-size:1.4rem;margin-bottom:.3rem}p{color:#a1a1aa;font-size:.9rem;line-height:1.5}#err{color:#f87171;font-size:.85rem;min-height:1.2rem;margin-top:1rem}</style></head><body><main><h1>CRM Flota</h1><p>Panel privado. Ingresá con tu cuenta de Google.</p>${
    si
      ? `<div id="g_id_onload" data-client_id="${esc(clientId!)}" data-callback="listo" data-auto_prompt="false"></div><div class="g_id_signin" data-type="standard" data-size="large" data-theme="filled_black" data-text="signin_with" data-shape="pill"></div><script src="https://accounts.google.com/gsi/client" async defer></script><script>function listo(r){fetch('/api/auth/google',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({credential:r.credential,next:${esc(JSON.stringify(quiero))}})}).then(async function(x){var j=await x.json();if(j.ok){location.href=j.next||'/';}else{document.getElementById('err').textContent=j.error||'No pudiste ingresar.';}}).catch(function(){document.getElementById('err').textContent='Error de red, probá de nuevo.';});}</script>`
      : `<p style="color:#f87171">Auth no configurado en el servidor: falta GOOGLE_CLIENT_ID / GOOGLE_WHITELIST en Pages.</p>`
  }<div id="err"></div></main></body></html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export const onRequest = async (context: any): Promise<Response> => {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const ruta = url.pathname;

  // Camino de auth siempre abierto (estado, canje GIS, logout).
  if (PUBLICOS.has(ruta)) return next();
  if (ruta.startsWith("/api/auth/")) return next();

  // /login: si ya hay sesión, adentro; si no, el propio HTML de login.
  if (ruta === "/login") {
    const ses = await sesionActiva(env.DB, getCookie(request.headers.get("cookie"), SESSION_COOKIE));
    if (ses) return Response.redirect(new URL("/", request.url).toString(), 302);
    return paginaLogin(env.GOOGLE_CLIENT_ID, "/");
  }

  // Máquinas: Bearer de management sigue operativo (pulse, deploys por curl).
  const auth = request.headers.get("authorization") ?? "";
  if (env.CRM_TOKEN && auth === `Bearer ${env.CRM_TOKEN}`) return next();

  // Browser: sesión válida o nada.
  const ses = await sesionActiva(env.DB, getCookie(request.headers.get("cookie"), SESSION_COOKIE));
  if (ses) return next();

  // APIs: 401 JSON. Páginas/assets: HTML de login con Google.
  if (ruta.startsWith("/api/")) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
  return paginaLogin(env.GOOGLE_CLIENT_ID, (ruta === "/" ? "/" : ruta) + url.search);
};
