import { describe, expect, it } from "vitest";
import { seoInput } from "./validate";

describe("seoInput", () => {
  it("acepta métricas gsc válidas", () => {
    expect(
      seoInput({
        slug: "sueldoneto",
        dia: "2026-08-28",
        clicks: 3,
        impressions: 120,
        position: 14.2,
        gsc_url: "sc-domain:sueldoneto.com.ar",
      })
    ).toMatchObject({ slug: "sueldoneto", dia: "2026-08-28", clicks: 3 });
  });

  it("acepta pulse seo (robots/sitemap) con nulls", () => {
    expect(
      seoInput({ slug: "reditos", dia: "2026-08-30", robots_ok: 1, sitemap_ok: 1 })
    ).toMatchObject({ robots_ok: 1, sitemap_ok: 1, clicks: null });
  });

  it("rechaza dia malformado", () => {
    expect(() => seoInput({ slug: "x", dia: "30-08-2026" })).toThrow();
  });

  it("rechaza slug vacío", () => {
    expect(() => seoInput({ slug: "", dia: "2026-08-30" })).toThrow();
  });

  it("rechaza clicks negativos", () => {
    expect(() => seoInput({ slug: "x", dia: "2026-08-30", clicks: -1 })).toThrow();
  });
});
