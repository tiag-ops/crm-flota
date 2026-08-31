export async function requireToken(
  c: any,
  next: () => Promise<void>
): Promise<Response | undefined> {
  const auth = c.req.header("Authorization");
  // En Pages Functions el token vive en bindings (c.env); en vitest, en process.env.
  const expected: string | undefined = c?.env?.CRM_TOKEN ?? process.env.CRM_TOKEN;
  if (!auth || !expected || auth !== `Bearer ${expected}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  await next();
}
