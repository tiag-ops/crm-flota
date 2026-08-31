import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

export interface SaJson {
  client_email: string;
  private_key: string;
}

export function loadSa(path?: string): SaJson {
  const raw = path ?? process.env.GSC_SA_PATH ?? "C:/Users/tiago/.crm-secrets/gsc-sa.json";
  return JSON.parse(readFileSync(raw, "utf8"));
}

export function buildJwt(sa: SaJson, now = Math.floor(Date.now() / 1000)): string {
  const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");
  const hdr = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64u(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const sig = createSign("RSA-SHA256")
    .update(`${hdr}.${claim}`)
    .sign(sa.private_key, "base64url");
  return `${hdr}.${claim}.${sig}`;
}

let cache: { token: string; exp: number } | null = null;

export async function getToken(sa: SaJson): Promise<string> {
  if (cache && cache.exp > Date.now() / 1000 + 60) return cache.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${buildJwt(sa)}`,
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error(`GSC token error: ${JSON.stringify(data)}`);
  cache = { token: data.access_token, exp: Date.now() / 1000 + (data.expires_in ?? 3600) };
  return cache.token;
}

export interface GscRow {
  dia: string;
  clicks: number;
  impressions: number;
  position: number | null;
}

export async function queryGscDaily(
  sa: SaJson,
  siteUrl: string,
  start: string,
  end: string
): Promise<GscRow[]> {
  const token = await getToken(sa);
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: start, endDate: end, dimensions: ["date"] }),
    }
  );
  const data = (await res.json()) as {
    rows?: { keys: string[]; clicks: number; impressions: number; position?: number }[];
  };
  return (data.rows ?? []).map((r) => ({
    dia: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    position: r.position ?? null,
  }));
}
