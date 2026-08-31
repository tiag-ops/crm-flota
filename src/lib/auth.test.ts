import { describe, expect, it } from "vitest";
import { requireToken } from "./auth";

const makeCtx = (header: string | undefined) =>
  ({ req: { header: (n: string) => header } }) as any;

describe("requireToken", () => {
  it("rechaza sin header", async () => {
    const res = await requireToken(makeCtx(undefined), async () => new Response("no"));
    expect(res.status).toBe(401);
  });

  it("rechaza token incorrecto", async () => {
    const res = await requireToken(makeCtx("Bearer mal"), async () => new Response("no"));
    expect(res.status).toBe(401);
  });

  it("deja pasar el token correcto", async () => {
    const res = await requireToken(makeCtx("Bearer secreto123"), async () => new Response("ok"));
    expect(await res.text()).toBe("ok");
  });
});
