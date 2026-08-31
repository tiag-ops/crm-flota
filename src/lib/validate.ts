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
