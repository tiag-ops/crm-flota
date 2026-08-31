import { afterEach, describe, expect, it, vi } from "vitest";
import { buildJwt, queryGscDaily, type SaJson } from "./gsc";

const SA: SaJson = {
  client_email: "test@test.iam.gserviceaccount.com",
  // clave RSA de prueba (solo estructura; no se valida contra Google)
  private_key: `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDS3vSb3Jhry3JY
izuC73UaF23JPYhysR5PZNKou+H820z0u8HjfK69TA0R5lyaV4NWbrClQd2OlMu1
Vxybzf/CP2p8md3Zks2sOfe/qJfvoXVTd4NpFfJZ27ena7ua5WbLMD1Exi8xyQ7V
K00RJLkCjU9X7iJKy6WGGtxabP7gKQzbO0J3y42S5PzHM+5qsHMB/B1Ou4N3h3g7
7NH1kLxavD+qpbMJ42HPRBEJRmDMjD6jbp2QiSGA5Ny7i7ozvkf7HZA5YTrB6E/V
1lUhYDwoDLZRcusidMMzaM2J5QYxY7t1BiaTFNWxz0sEKmWFkET28sr1cm/74h4c
dmkAK1XRAgMBAAECggEATAm5irpw++3Qvbz3KK/QOihYnkhh+3mCxH5GuDGHu/YY
Oee6cp1zJS9XRy0aF02XPoOLjwvBKLje+/T9i/EsWI8lhui05s/Y+lGs1J+mqfI+
rGpcKHiRe3WPM//VFnXCK2KptTMBsaIehx+mGphzXkg2ZC6qju4AMetdqf3DqnB7
cdSuH874uzUI+Q98UKyWjFpdPuDqxtTtpSTh/KICCk3PDGxxMbk+P9dmYq3HLYS+
95pumxkwhOum3FWdZhD68e6nKJRY2bAhSx26oa4TfrVOgWEbswJraBve3ZsFjr/L
g7pxRoUSLgomN+19O+mQUZjfBOGpdbBAQunxRHYPQQKBgQDpMoP5B1W5uNKSpb8d
Xet5KxcX9j4nDgPNhmOxJXi+Yri5QPOlMeCppL6tGOVRdYAUlG5BmGsYPHfWxtg4
/oYCeHRmjLPafgPvV1X3O8KZGTPJyiSNfIzRnk/0iHHo5wXR+z1W2gX9/nHePpia
uUbpm262vD16/GoK/tcrIEzd5wKBgQDnfY6OX63kYXZgnlTd38gw3BWe+/RUh1RN
AUBBNUWXOjmsm1Cr73g7y04IUIduX2lHCxYhf77tuqyt0hMTBTn+anb5PRrmyUEo
6JYktNE7RYXCKjwyytgwNjW3n+8uK6FltgloPOOXMLfaowmtOyP1qyVDkLpvSQbU
VokCyccHhwKBgQDS5rvSkh6mrA/NTxeMMK/Q0va81hgZ7CPmUb+Bq7kKvnAAI0z3
PyfHZVaJaDWlOVZPxnn82yMoNS/Qz98nlJGQVG45fNEALu3SHTODOMni+pcKzcXH
LDiTL9Fx/6C9mYp7APTVwrKeputGq2gKrrwCdG9p1s7nlrc1IItq1niOSwKBgQCp
zrZlxdW/M6csVLiYUPF+tdK+Xr/pyaOTIRnLO5KizjlEXmIc3XrrEcVZ4AiYdDC7
xmwjgpvBsy+8Cd+oEitqbxp61dIH/RVpNsP8hQ7+VY860NR7xcQ0CW/6FL3Utnic
LZ5U8mVYoIodPX95rWpBaZvaJi48N+tkk13Jx83RvQKBgQCjthU33UMlyh7PG1Ax
X/OemF01dGQoUKKpPC0nXx7MRc7A5s/vMFE6pwE7cP8b6M1XPs4+bWXKs8pT12Sc
5hvKZcARd5ycPCWYLn0wHElbQSMnWKxmbjRVY4VGxsLreAOW3rou4cS9YKT5NiXf
ucjAjBwvsr2PNWdaazQK4CTgKA==
-----END PRIVATE KEY-----`,
};

describe("buildJwt", () => {
  it("genera 3 segmentos con claims correctos", () => {
    const parts = buildJwt(SA, 1700000000).split(".");
    expect(parts).toHaveLength(3);
    const claim = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    expect(claim.iss).toBe("test@test.iam.gserviceaccount.com");
    expect(claim.aud).toBe("https://oauth2.googleapis.com/token");
    expect(claim.exp - claim.iat).toBe(3600);
    expect(claim.scope).toContain("webmasters.readonly");
  });
});

describe("queryGscDaily", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("mapea rows de GSC a filas diarias", async () => {
    const fake = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("oauth2.googleapis.com/token"))
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
      return new Response(
        JSON.stringify({
          rows: [
            { keys: ["2026-08-27"], clicks: 3, impressions: 120, position: 14.2 },
            { keys: ["2026-08-28"], clicks: 0, impressions: 0 },
          ],
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fake as unknown as typeof fetch);
    const rows = await queryGscDaily(SA, "sc-domain:example.com", "2026-08-22", "2026-08-28");
    expect(rows).toEqual([
      { dia: "2026-08-27", clicks: 3, impressions: 120, position: 14.2 },
      { dia: "2026-08-28", clicks: 0, impressions: 0, position: null },
    ]);
  });
});
