// Mock de GitHub SOLO para tests E2E (local). Inerte en producción: exige el
// binding GH_MOCK="1", que nunca existe en Pages prod/preview.
// Imita: /login/oauth/authorize (minte code de un solo uso, 302 al callback),
// /login/oauth/access_token (consume el code) y /user (perfil por bearer).
// El N-ésimo code minteado responde como PERSONAS[(N-1) % len] → permite probar
// whitelist (persona 1 = tiag-ops ok, persona 2 = intruso denegado).
import { Hono } from "hono";

type Persona = { login: string; id: number };
const PERSONAS: Persona[] = [
  { login: "tiag-ops", id: 314013847 },
  { login: "intruso", id: 999999 },
];
const codes = new Map<string, number>(); // code → índice de persona (n de mintage)
let seq = 0;

export const onRequest = async (context: any): Promise<Response> => {
  if (context.env.GH_MOCK !== "1") {
    return new Response("not found", { status: 404 });
  }
  const app = new Hono();

  app.get("/api/mock-github/login/oauth/authorize", (c: any) => {
    const u = new URL(c.req.url);
    const cb = u.searchParams.get("redirect_uri") ?? "";
    const state = u.searchParams.get("state") ?? "";
    const sep = cb.includes("?") ? "&" : "?";
    const code = `mock-code-${++seq}`;
    codes.set(code, seq);
    return c.redirect(`${cb}${sep}code=${code}&state=${encodeURIComponent(state)}`, 302);
  });

  app.post("/api/mock-github/login/oauth/access_token", async (c: any) => {
    const body = await c.req.json().catch(() => ({}));
    const persona = codes.get(String(body?.code ?? ""));
    if (persona === undefined) {
      return Response.json({ error: "bad_verification_code" });
    }
    codes.delete(String(body.code)); // un solo uso, como github real
    return Response.json({ access_token: `gho_tok_${persona}`, token_type: "bearer" });
  });

  app.get("/api/mock-github/user", (c: any) => {
    const m = /Bearer gho_tok_(\d+)/.exec(c.req.header("authorization") ?? "");
    const persona = m ? Number(m[1]) : 0;
    const p = PERSONAS[(persona - 1) % PERSONAS.length];
    if (!p) return Response.json({ message: "Bad credentials" }, { status: 401 });
    return Response.json(p);
  });

  return app.fetch(context.request, context.env);
};
