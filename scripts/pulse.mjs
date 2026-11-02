// Chequea cada sitio de la flota y reporta al CRM.
// Env requeridos: CRM_API (URL base del CRM), CRM_TOKEN (token de escritura).
const API = process.env.CRM_API;
const TOKEN = process.env.CRM_TOKEN;
if (!API || !TOKEN) {
  console.error("Faltan CRM_API o CRM_TOKEN");
  process.exit(1);
}

// El panel tiene candado global: hasta /api/sites pide el Bearer de máquina.
const auth = { authorization: `Bearer ${TOKEN}` };
const resSites = await fetch(`${API}/api/sites`, { headers: auth });
if (!resSites.ok) {
  console.error(`GET /api/sites falló con ${resSites.status}`);
  process.exit(1);
}
const sites = await resSites.json();
if (!Array.isArray(sites)) {
  console.error("GET /api/sites no devolvió una lista:", JSON.stringify(sites));
  process.exit(1);
}
const resultados = [];

for (const site of sites) {
  const target = site.slug === "crm" ? `${API}/` : site.url;
  if (!target) {
    console.log(`${site.slug}: sin URL, skip`);
    continue;
  }
  let http_status = null;
  let ok = 0;
  try {
    const res = await fetch(target, { redirect: "follow", signal: AbortSignal.timeout(15000) });
    http_status = res.status;
    ok = res.ok ? 1 : 0;
  } catch {
    http_status = null;
    ok = 0;
  }
  const post = await fetch(`${API}/api/checks`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ slug: site.slug, ok, http_status }),
  });
  if (!post.ok) {
    console.error(`${site.slug}: POST /api/checks falló con ${post.status}`);
    process.exitCode = 1;
  }
  resultados.push({ slug: site.slug, ok, http_status });
  console.log(`${site.slug}: ${ok ? "OK" : "FAIL"} ${http_status ?? "sin respuesta"}`);
}

const caidos = resultados.filter((r) => !r.ok);
console.log(`Resumen: ${resultados.length} chequeados, ${caidos.length} caídos`);
if (caidos.length > 0) process.exitCode = 1;
