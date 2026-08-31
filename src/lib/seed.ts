export interface SiteRow {
  slug: string;
  nombre: string;
  url: string;
  repo: string;
  pages_project: string;
  estado: string;
  notas: string;
}

export function seedSites(sites: Omit<SiteRow, never>[]): SiteRow[] {
  const slugs = sites.map((s) => s.slug);
  const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  if (dupes.length > 0) throw new Error(`slug duplicado: ${dupes.join(", ")}`);
  return sites.map((s) => ({
    slug: s.slug,
    nombre: s.nombre,
    url: s.url,
    repo: s.repo,
    pages_project: s.pages_project,
    estado: s.estado,
    notas: s.notas ?? "",
  }));
}
