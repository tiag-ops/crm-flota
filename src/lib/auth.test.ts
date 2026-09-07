import { describe, expect, it } from "vitest";
import { requireToken, requireEscritura } from "./auth";
import {
  crearSesion,
  getCookie,
  randomToken,
  sha256hex,
  SESSION_COOKIE,
} from "./session";

const makeCtx = (headers: Record<string, string>, db?: any, env?: any) =>
  ({
    req: { header: (n: string) => headers[n.toLowerCase()] },
    env: { DB: db, CRM_TOKEN: "tok-maquina", ...env },
    _sesion: undefined as any,
    set(k: string, v: unknown) {
      this._sesion = v;
    },
  }) as any;
function dbFalsa(filas: any[] = []) {
  return {
    prepare(_sql: string) {
      return {
        bind(..._args: unknown[]) {
          return {
            first: async () => filas[0] ?? null,
            run: async () => ({}),
          };
        },
        first: async () => filas[0] ?? null,
      };
    },
  };
}

describe("requireToken (máquina, sin cambios)", () => {
  const base = makeCtx({});
  it("rechaza sin header", async () => {
    const res = await requireToken(makeCtx({}), base.env);
    expect(res?.status).toBe(401);
  });
  it("rechaza token incorrecto", async () => {
    const res = await requireToken(makeCtx({ authorization: "Bearer mal" }), base.env);
    expect(res?.status).toBe(401);
  });
  it("deja pasar el token correcto (ejecuta next)", async () => {
    let pasado = false;
    const res = await requireToken(
      makeCtx({ authorization: "Bearer tok-maquina" }),
      async () => {
        pasado = true;
      }
    );
    expect(pasado).toBe(true);
    expect(res).toBeUndefined();
  });
});

describe("requireEscritura", () => {
  it("acepta Bearer de máquina", async () => {
    let pasado = false;
    const res = await requireEscritura(
      makeCtx({ authorization: "Bearer tok-maquina" }, dbFalsa()),
      async () => {
        pasado = true;
      }
    );
    expect(pasado).toBe(true);
    expect(res).toBeUndefined();
  });

  it("acepta sesión via cookie", async () => {
    let pasado = false;
    const ses = { email: "tiago@ejemplo.com", sub: "123" };
    const c = makeCtx({ cookie: `${SESSION_COOKIE}=abc123` }, dbFalsa([ses]));
    const res = await requireEscritura(c, async () => {
      pasado = true;
    });
    expect(pasado).toBe(true);
    expect(res).toBeUndefined();
    expect(c._sesion).toEqual(ses);
  });

  it("rechaza cookie con sesión inexistente", async () => {
    const res = await requireEscritura(
      makeCtx({ cookie: `${SESSION_COOKIE}=fanta` }, dbFalsa()),
      async () => {}
    );
    expect(res?.status).toBe(401);
  });

  it("rechaza sin cookie ni bearer", async () => {
    expect((await requireEscritura(makeCtx({}, dbFalsa()), async () => {}))?.status).toBe(401);
  });
});

describe("helpers de cookie", () => {
  it("getCookie lee la primera y tolera espacios", () => {
    const h = "a=1; crm_session=tok; b=2";
    expect(getCookie(h, "crm_session")).toBe("tok");
    expect(getCookie(h, "nope")).toBeUndefined();
  });

  it("cookie de sesión es HttpOnly + Secure + SameSite=Lax", async () => {
    const db = {
      prepare() {
        return { bind: () => ({ run: async () => ({}) }) };
      },
    };
    const { raw, cookie } = await crearSesion(db, "tiago@ejemplo.com", "sub-1");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("sha256hex", () => {
  it("hasha determinístico", async () => {
    expect(await sha256hex("hola")).toHaveLength(64);
    expect(await sha256hex("hola")).toBe(await sha256hex("hola"));
  });
  it("randomToken no repite", () => {
    expect(randomToken()).not.toBe(randomToken());
  });
});
