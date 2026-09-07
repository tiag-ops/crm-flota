/** Debe empezar con "/" y no ser protocol-relative (open redirect). */
export function nextSeguro(next: string | undefined | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
