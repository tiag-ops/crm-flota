# Inspecciona env_vars efectivos de los ultimos deployments de crm-flota.
import json
import os
import urllib.request

TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]
BASE = "https://api.cloudflare.com/client/v4"


def api(path):
    req = urllib.request.Request(BASE + path, headers={"Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.load(r)
    if not d.get("success"):
        raise SystemExit(f"API error: {json.dumps(d.get('errors'))[:300]}")
    return d["result"]


cuenta = api("/accounts")[0]["id"]
deps = api(f"/accounts/{cuenta}/pages/projects/crm-flota/deployments")[:3]
for dep in deps:
    prod = dep.get("deployment_config", {}).get("production", {})
    envs = prod.get("env_vars", {})
    print(dep["id"][:8], dep.get("created_on", "")[:19], "env_vars:", sorted(envs.keys()))
