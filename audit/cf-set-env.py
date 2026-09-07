# Setea GOOGLE_CLIENT_ID y GOOGLE_WHITELIST en Pages crm-flota (production) via API.
import json
import os
import urllib.request

TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]
CLIENT_ID = "762489741608-464bb6ha2cut1963abssjjdfge8972v6.apps.googleusercontent.com"
WHITELIST = "tiagomusu@gmail.com"
BASE = "https://api.cloudflare.com/client/v4"


def api(method, path, body=None):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {TOKEN}", "content-type": "application/json"},
        method=method,
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.load(r)
    if not d.get("success"):
        raise SystemExit(f"API error en {path}: {json.dumps(d.get('errors'))[:400]}")
    return d["result"]


cuentas = api("GET", "/accounts")
if not cuentas:
    raise SystemExit("token sin cuentas")
cuenta = cuentas[0]["id"]
if len(cuentas) > 1:
    print("cuentas:", [(c["id"], c["name"]) for c in cuentas])

proyecto = api("GET", f"/accounts/{cuenta}/pages/projects/crm-flota")
backup_path = os.path.join(os.environ.get("LOCALAPPDATA", "."), "Temp", "crm-flota-proj-backup.json")
with open(backup_path, "w", encoding="utf-8") as f:
    json.dump(proyecto, f)
prod_env = proyecto.get("deployment_configs", {}).get("production", {}).get("env_vars", {})
print("vars production ACTUALES:", {k: ("secret" if (v or {}).get("type") == "secret_text" else "plain") for k, v in prod_env.items()})
print("backup ->", backup_path)

# Solo las dos nuevas: PATCH hace merge de env_vars (no toca las existentes).
api(
    "PATCH",
    f"/accounts/{cuenta}/pages/projects/crm-flota",
    {
        "deployment_configs": {
            "production": {
                "env_vars": {
                    "GOOGLE_CLIENT_ID": {"type": "plain_text", "value": CLIENT_ID},
                    "GOOGLE_WHITELIST": {"type": "plain_text", "value": WHITELIST},
                }
            }
        }
    },
)

despues = api("GET", f"/accounts/{cuenta}/pages/projects/crm-flota")
final = despues.get("deployment_configs", {}).get("production", {}).get("env_vars", {})
ok = final.get("GOOGLE_CLIENT_ID", {}).get("value") == CLIENT_ID and final.get("GOOGLE_WHITELIST", {}).get("value") == WHITELIST
print("vars production DESPUES:", sorted(final.keys()))
print("VERIFICACION:", "OK" if ok else "FALLO")
