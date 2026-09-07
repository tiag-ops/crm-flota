import { describe, expect, it } from "vitest";
import {
  verificarIdToken,
  emailAutorizado,
  googleConfigurado,
  type GoEnv,
} from "./goauth";

const jsonRes = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as any;

const ENV: GoEnv = {
  GOOGLE_CLIENT_ID: "123-abc.apps.googleusercontent.com",
  GOOGLE_WHITELIST: "Tiago@Ejemplo.com, otro@x.com",
};

describe("googleConfigurado", () => {
  it("false sin client id o whitelist", () => {
    expect(googleConfigurado({})).toBe(false);
    expect(googleConfigurado({ GOOGLE_CLIENT_ID: "x" })).toBe(false);
    expect(googleConfigurado({ GOOGLE_WHITELIST: "a@b.c" })).toBe(false);
    expect(googleConfigurado(ENV)).toBe(true);
  });
});

describe("verificarIdToken", () => {
  const cred = "eyJhbGciOiJSUzI1NiJ9.falso.token";

  it("valida aud + email_verified y normaliza email", async () => {
    const u = await verificarIdToken(cred, ENV, async () =>
      jsonRes({
        aud: ENV.GOOGLE_CLIENT_ID,
        sub: "999",
        email: "Tiago@Ejemplo.com",
        email_verified: "true",
      })
    );
    expect(u).toEqual({ sub: "999", email: "tiago@ejemplo.com" });
  });

  it("rechaza aud de otra app", async () => {
    const u = await verificarIdToken(cred, ENV, async () =>
      jsonRes({ aud: "otra-app", sub: "1", email: "a@b.c", email_verified: "true" })
    );
    expect(u).toBeNull();
  });

  it("rechaza email sin verificar", async () => {
    const u = await verificarIdToken(cred, ENV, async () =>
      jsonRes({ aud: ENV.GOOGLE_CLIENT_ID, sub: "1", email: "a@b.c", email_verified: "false" })
    );
    expect(u).toBeNull();
  });

  it("rechaza credential vacío sin fetch", async () => {
    let llamado = 0;
    const u = await verificarIdToken("", ENV, async () => {
      llamado++;
      return jsonRes({});
    });
    expect(u).toBeNull();
    expect(llamado).toBe(0);
  });

  it("rechaza si Google devuelve 400", async () => {
    const u = await verificarIdToken("vencido", ENV, async () =>
      jsonRes({ error_description: "Invalid Value" }, 400)
    );
    expect(u).toBeNull();
  });
});

describe("emailAutorizado", () => {
  it("case-insensitive con espacios", () => {
    expect(emailAutorizado("tiago@ejemplo.com", ENV)).toBe(true);
    expect(emailAutorizado("OTRO@X.com", ENV)).toBe(true);
    expect(emailAutorizado("intruso@evil.com", ENV)).toBe(false);
  });
});
