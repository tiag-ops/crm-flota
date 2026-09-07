import { describe, expect, it } from "vitest";
import {
  githubConfigurado,
  intercambiarCodigo,
  urlAuthorize,
  usuarioGithub,
} from "./gh-oauth";

const jsonRes = (status: number, body: unknown) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

describe("githubConfigurado", () => {
  it("exige id y secret", () => {
    expect(githubConfigurado(undefined)).toBe(false);
    expect(githubConfigurado({ GITHUB_CLIENT_ID: "x" })).toBe(false);
    expect(githubConfigurado({ GITHUB_CLIENT_SECRET: "y" })).toBe(false);
    expect(githubConfigurado({ GITHUB_CLIENT_ID: "x", GITHUB_CLIENT_SECRET: "y" })).toBe(true);
  });
});

describe("urlAuthorize", () => {
  it("apunta a github.com con state y redirect_uri", () => {
    const u = urlAuthorize("cid-123", "https://crm-flota.pages.dev/api/auth/callback", "st-abc");
    expect(u).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize\?/);
    expect(u).toContain("client_id=cid-123");
    expect(u).toContain("state=st-abc");
    expect(u).toContain(
      `redirect_uri=${encodeURIComponent("https://crm-flota.pages.dev/api/auth/callback")}`
    );
  });
});

describe("intercambiarCodigo", () => {
  it("devuelve el access_token cuando GitHub responde ok", async () => {
    let pedida: URL | undefined;
    const tok = await intercambiarCodigo(
      { GITHUB_CLIENT_ID: "cid", GITHUB_CLIENT_SECRET: "sec" },
      "code-1",
      "https://crm-flota.pages.dev/api/auth/callback",
      async (url, init) => {
        pedida = new URL(url);
        expect(JSON.parse(init.body)).toMatchObject({ code: "code-1", client_id: "cid", client_secret: "sec" });
        return jsonRes(200, { access_token: "gho_abc" }) as any;
      }
    );
    expect(pedida?.host).toBe("github.com");
    expect(pedida?.pathname).toBe("/login/oauth/access_token");
    expect(tok).toBe("gho_abc");
  });

  it("null si GitHub rechaza (error en el body, status 200 por spec)", async () => {
    const tok = await intercambiarCodigo(
      { GITHUB_CLIENT_ID: "cid", GITHUB_CLIENT_SECRET: "vieja" },
      "code-1",
      "https://x/api/auth/callback",
      async () => jsonRes(200, { error: "bad_verification_code" }) as any
    );
    expect(tok).toBeNull();
  });

  it("null si la red/exchange explota", async () => {
    const tok = await intercambiarCodigo(
      { GITHUB_CLIENT_ID: "cid", GITHUB_CLIENT_SECRET: "s" },
      "c",
      "https://x/cb",
      async () => jsonRes(500, {}) as any
    );
    expect(tok).toBeNull();
  });
});

describe("usuarioGithub", () => {
  it("mapea login e id", async () => {
    const u = await usuarioGithub("gho_ok", undefined, async (url: string, init: any) => {
      expect(new URL(url).host).toBe("api.github.com");
      expect(init.headers.authorization).toBe("Bearer gho_ok");
      return jsonRes(200, { login: "tiag-ops", id: 314013847 }) as any;
    });
    expect(u).toEqual({ login: "tiag-ops", id: 314013847 });
  });

  it("null si el token no sirve (401)", async () => {
    const u = await usuarioGithub("gho_vencido", undefined, async () => jsonRes(401, {}) as any);
    expect(u).toBeNull();
  });

  it("null si la respuesta no trae la forma esperada", async () => {
    const u = await usuarioGithub("gho_raro", undefined, async () => jsonRes(200, { login: 42 }) as any);
    expect(u).toBeNull();
  });
});
