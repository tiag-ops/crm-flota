import { urlAuthorize, type GhEnv, type GhUser } from "./gh-oauth";

/** Debe empezar con "/" y no ser protocol-relative (open redirect). */
export function nextSeguro(next: string | undefined | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

/** Whitelist del panel: ids de GitHub con acceso. */
export function autorizado(u: GhUser): boolean {
  return GH_USER_IDS.includes(u.id);
}

/** tiag-ops = dueño de la flota. Agregar ids aca (lista chico, no vale una tabla en D1). */
export const GH_USER_IDS: number[] = [314013847];

export function payloadEstado(next: string): string {
  return btoa(JSON.stringify({ n: crypto.randomUUID(), next }));
}

export function leerEstado(raw: string | undefined): { next: string } | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(atob(raw));
    return typeof o?.next === "string" ? { next: nextSeguro(o.next) } : null;
  } catch {
    return null;
  }
}

export function urlLogin(
  envOrigin: string,
  clientId: string,
  state: string,
  env?: GhEnv
): string {
  return urlAuthorize(clientId, `${envOrigin}/api/auth/callback`, state, env);
}
