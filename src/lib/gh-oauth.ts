// OAuth GitHub app-to-app (web flow). Los secretos SIEMPRE vienen del entorno
// (bindings en workerd); nada hardcodeado. Las bases de URL son overridables
// SOLO para tests E2E con mock (GH_OAUTH_BASE_URL / GH_API_BASE_URL); en prod
// no existen como bindings y caen a los defaults oficiales.
export type GhUser = { login: string; id: number };
export type GhEnv = {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GH_OAUTH_BASE_URL?: string;
  GH_API_BASE_URL?: string;
};

export function githubBase(env: GhEnv | undefined): string {
  return env?.GH_OAUTH_BASE_URL || "https://github.com";
}

export function githubApiBase(env: GhEnv | undefined): string {
  return env?.GH_API_BASE_URL || "https://api.github.com";
}

export function githubConfigurado(env: GhEnv | undefined): boolean {
  return Boolean(env?.GITHUB_CLIENT_ID && env?.GITHUB_CLIENT_SECRET);
}

/** URL del botón "Iniciar sesión con GitHub". state = anti-CSRF, lo lleva cookie espejo. */
export function urlAuthorize(clientId: string, redirectUri: string, state: string, env?: GhEnv): string {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "",
    state,
  });
  return `${githubBase(env)}/login/oauth/authorize?${q.toString()}`;
}

type fetchLike = (url: string, init?: any) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

/** Intercambia ?code por access token (POST <github>/login/oauth/access_token). */
export async function intercambiarCodigo(
  env: GhEnv,
  code: string,
  redirectUri: string,
  doFetch: fetchLike = fetch
): Promise<string | null> {
  const res = await doFetch(`${githubBase(env)}/login/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  return typeof j?.access_token === "string" && j.access_token ? j.access_token : null;
}

/** GET <api.github>/user con el access token. null si viene 401/404 (token inválido). */
export async function usuarioGithub(token: string, env?: GhEnv, doFetch: fetchLike = fetch): Promise<GhUser | null> {
  const res = await doFetch(`${githubApiBase(env)}/user`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "crm-flota/1.0",
    },
  });
  if (!res.ok) return null;
  const j = await res.json();
  if (typeof j?.login !== "string" || typeof j?.id !== "number") return null;
  return { login: j.login, id: j.id };
}
