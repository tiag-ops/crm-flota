import { describe, expect, it } from "vitest";
import { requireToken } from "./auth";

const makeCtx = (header: string | undefined) =>
  ({ req: { header: (n: string) => header } }) as any;

describe("requireToken", () => {
  it("rechaza sin header", async () => {
    const res = await requireToken(makeCtx(undefined), async () => {});
    expect(res?.status).toBe(401);
  });

  it("rechaza token incorrecto", async () => {
    const res = await requireToken(makeCtx("Bearer mal"), async () => {});
    expect(res?.status).toBe(401);
  });

  it("deja pasar el token correcto (ejecuta next)", async () => {
    let pasado = false;
    const res = await requireToken(makeCtx("Bearer secreto123"), async () => {
      pasado = true;
    });
    expect(pasado).toBe(true);
    expect(res).toBeUndefined();
  });
});
