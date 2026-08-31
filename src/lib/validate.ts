export interface CheckInput {
  slug: string;
  ok: number;
  http_status: number | null;
}

export function checkInput(raw: {
  slug: unknown;
  ok: unknown;
  http_status: unknown;
}): CheckInput {
  const slug = typeof raw.slug === "string" ? raw.slug.trim() : "";
  if (!slug) throw new Error("campo slug requerido");

  const ok = raw.ok;
  if (ok !== 0 && ok !== 1) {
    throw new Error("campo ok debe ser 0|1");
  }

  const hs = raw.http_status;
  const http_status = hs === null || hs === undefined ? null : Number(hs);
  if (http_status !== null && !Number.isInteger(http_status)) {
    throw new Error("http_status debe ser entero o null");
  }

  return { slug, ok, http_status };
}

export interface SeoInput {
  slug: string;
  dia: string;
  clicks: number | null;
  impressions: number | null;
  position: number | null;
  robots_ok: number | null;
  sitemap_ok: number | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function numOrNull(v: unknown, name: string, min = 0): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw new Error(`campo ${name} inválido`);
  return n;
}

function bitOrNull(v: unknown, name: string): number | null {
  if (v === null || v === undefined) return null;
  if (v !== 0 && v !== 1) throw new Error(`campo ${name} debe ser 0|1 o null`);
  return v;
}

export function seoInput(raw: Record<string, unknown>): SeoInput {
  const slug = typeof raw.slug === "string" ? raw.slug.trim() : "";
  if (!slug) throw new Error("campo slug requerido");
  const dia = typeof raw.dia === "string" ? raw.dia.trim() : "";
  if (!ISO_DATE.test(dia)) throw new Error("campo dia debe ser YYYY-MM-DD");
  const hasAny = ["clicks", "impressions", "position", "robots_ok", "sitemap_ok"].some(
    (k) => raw[k] !== undefined && raw[k] !== null
  );
  if (!hasAny) throw new Error("al menos una métrica requerida");
  return {
    slug,
    dia,
    clicks: numOrNull(raw.clicks, "clicks"),
    impressions: numOrNull(raw.impressions, "impressions"),
    position: numOrNull(raw.position, "position"),
    robots_ok: bitOrNull(raw.robots_ok, "robots_ok"),
    sitemap_ok: bitOrNull(raw.sitemap_ok, "sitemap_ok"),
  };
}
