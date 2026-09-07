// Auth Google Sign-In (GIS one-tap). Sin backend-secret: el browser recibe un
// id_token (JWT firmado por Google) que verificamos server-side via tokeninfo
// (valida firma, audiencia y vencimiento). Solo hace falta GOOGLE_CLIENT_ID.
// GO_TOKENINFO_BASE_URL existe SOLO para el E2E con mock (en prod no se define).
export type GoogleUser = { sub: string; email: string };

export type GoEnv = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_WHITELIST?: string; // emails separados por coma
  GO_TOKENINFO_BASE_URL?: string;
};

export function googleConfigurado(env: GoEnv | undefined): boolean {
  return Boolean(env?.GOOGLE_CLIENT_ID && env?.GOOGLE_WHITELIST);
}

function tokeninfoBase(env: GoEnv | undefined): string {
  return env?.GO_TOKENINFO_BASE_URL || "https://oauth2.googleapis.com";
}

export async function verificarIdToken(
  credential: string,
  env: GoEnv,
  doFetch: fetchLike = fetch
): Promise<GoogleUser | null> {
  if (!credential || credential.length > 4096) return null;
  const res = await doFetch(
    `${tokeninfoBase(env)}/tokeninfo?id_token=${encodeURIComponent(credential)}`,
    { headers: { "user-agent": "crm-flota/1.0" } }
  );
  if (!res.ok) return null;
  const j = await res.json();
  if (j?.aud !== env.GOOGLE_CLIENT_ID) return null;
  if (j?.email_verified !== "true" && j?.email_verified !== true) return null;
  if (typeof j?.email !== "string" || !j.email) return null;
  return { sub: String(j.sub ?? ""), email: j.email.toLowerCase() };
}

type fetchLike = (url: string, init?: any) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

/** ¿El email está en la whitelist del env? (GOOGLE_WHITELIST="a@x.com,b@y.com") */
export function emailAutorizado(email: string, env: GoEnv): boolean {
  const lista = (env.GOOGLE_WHITELIST ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(email.toLowerCase());
}
