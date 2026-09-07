import { getCookie, sesionActiva, SESSION_COOKIE } from "./session";

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

/** Puerta de máquina: Bearer CRM_TOKEN estático (pulse, scripts, curl). */
export async function requireToken(
  c: any,
  next: () => Promise<void>
): Promise<Response | undefined> {
  const auth = c.req.header("Authorization");
  // En Pages Functions el token vive en bindings (c.env); en vitest, en process.env.
  const expected: string | undefined = c?.env?.CRM_TOKEN ?? process.env.CRM_TOKEN;
  if (!auth || !expected || auth !== `Bearer ${expected}`) {
    return unauthorized();
  }
  await next();
}

/** Puerta de escritura: acepta Bearer de máquina O sesión de browser (cookie OAuth). */
export async function requireEscritura(
  c: any,
  next: () => Promise<void>
): Promise<Response | undefined> {
  const auth = c.req.header("Authorization");
  const expected: string | undefined = c?.env?.CRM_TOKEN ?? process.env.CRM_TOKEN;
  if (auth && expected && auth === `Bearer ${expected}`) {
    await next();
    return undefined;
  }
  const ses = await sesionActiva(
    c?.env?.DB,
    getCookie(c.req.header("Cookie"), SESSION_COOKIE)
  );
  if (ses) {
    c.set("sesion", ses);
    await next();
    return undefined;
  }
  return unauthorized();
}
