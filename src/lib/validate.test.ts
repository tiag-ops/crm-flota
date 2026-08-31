import { describe, expect, it } from "vitest";
import { checkInput } from "./validate";

describe("checkInput", () => {
  it("acepta un check válido", () => {
    expect(checkInput({ slug: "sueldoneto", ok: 1, http_status: 200 })).toEqual({
      slug: "sueldoneto",
      ok: 1,
      http_status: 200,
    });
  });

  it("acepta http_status null (sitio caído sin respuesta)", () => {
    expect(checkInput({ slug: "x", ok: 0, http_status: null })).toEqual({
      slug: "x",
      ok: 0,
      http_status: null,
    });
  });

  it("rechaza slug vacío", () => {
    expect(() => checkInput({ slug: "", ok: 1, http_status: 200 })).toThrow(/slug/);
  });

  it("rechaza ok que no sea 0|1", () => {
    expect(() => checkInput({ slug: "x", ok: true, http_status: 200 })).toThrow(/ok/);
    expect(() => checkInput({ slug: "x", ok: 2, http_status: 200 })).toThrow(/ok/);
  });
});
