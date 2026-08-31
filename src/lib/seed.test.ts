import { describe, expect, it } from "vitest";
import { seedSites } from "./seed";
import sites from "@/data/sites.json";

describe("seedSites", () => {
  it("convierte sites.json en filas D1 con slug como key", () => {
    const rows = seedSites(sites as any);
    expect(rows.length).toBe(sites.length);
    expect(rows[0]).toMatchObject({ slug: (sites as any)[0].slug });
    expect(rows[0]).toHaveProperty("nombre");
    expect(rows[0]).toHaveProperty("url");
  });

  it("falla si hay slugs duplicados", () => {
    const dup = [...(sites as any), { ...(sites as any)[0] }];
    expect(() => seedSites(dup)).toThrow(/slug duplicado/);
  });
});
