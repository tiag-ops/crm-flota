"""E2E del flujo OAuth del CRM contra `wrangler pages dev` con mock de GitHub
DENTRO del worker (/api/mock-github, activado por binding GH_MOCK=1 — inerte en prod).

Ejercita: login->authorize->callback->cookie, /status, POST con y sin sesion,
bearer de maquina, whitelist, CSRF, code reusado, logout. Puertos aleatorios =>
inmune a zombies de corridas cortadas.
"""
import http.cookiejar
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import time
import urllib.parse
import urllib.error
import urllib.request

resultados = []


def ok(nombre, cond, detalle=""):
    resultados.append((nombre, bool(cond), detalle))
    print(("PASS " if cond else "FAIL ") + nombre + (f" :: {detalle}" if detalle and not cond else ""), flush=True)


def motivo(html: bytes) -> str:
    m = re.search(r"<p>([^<]+)</p>", html.decode("utf-8", "replace"))
    return m.group(1)[:140] if m else html[:140].decode("utf-8", "replace")


def puerto_libre():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def esperar_puerto(port, timeout=40):
    fin = time.time() + timeout
    while time.time() < fin:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                return True
        except OSError:
            time.sleep(0.3)
    return False


class PoliticaTest(http.cookiejar.DefaultCookiePolicy):
    """Permite cookies Secure sobre http://localhost (en prod es https y no hace falta)."""

    def set_ok_secure(self, cookie):
        return True

    def return_ok_secure(self, cookie, request):
        return True


class Cliente:
    """HTTP client con cookies (simula el browser)."""

    def __init__(self):
        self.jar = http.cookiejar.CookieJar(policy=PoliticaTest())
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def _abrir(self, op, req):
        try:
            r = op.open(req, timeout=15)
            return r.status, dict(r.headers), r.read()
        except urllib.error.HTTPError as e:
            return e.code, dict(e.headers), e.read()

    def get(self, url, redirect=True):
        req = urllib.request.Request(url, headers={"User-Agent": "e2e/1.0"})
        if not redirect:
            class SinRedirect(urllib.request.HTTPRedirectHandler):
                def redirect_request(self, *a, **k):
                    return None

            op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar), SinRedirect)
            return self._abrir(op, req)
        return self._abrir(self.op, req)

    def post(self, url, data=None):
        body = json.dumps(data).encode() if data is not None else b""
        req = urllib.request.Request(
            url, data=body,
            headers={"User-Agent": "e2e/1.0", "content-type": "application/json"},
            method="POST",
        )
        return self._abrir(self.op, req)

    def sesion_cookie(self):
        for c in self.jar:
            if c.name == "crm_session":
                return c.value
        return None


def main():
    crm_port = puerto_libre()
    base = f"http://127.0.0.1:{crm_port}"
    mock_base = f"{base}/api/mock-github"

    env = dict(os.environ)
    env.setdefault("CRM_TOKEN", "dev-token-cambiar")
    npx = shutil.which("npx") or "npx"
    # stdout a archivo: el PIPE lleno deadlock-ea el test si wrangler charla mucho.
    log_path = os.path.join(
        os.environ.get("LOCALAPPDATA", os.path.dirname(os.path.abspath(__file__))),
        "Temp", f"oauth-e2e-wrangler-{os.getpid()}.log",
    )
    logf = open(log_path, "w", encoding="utf-8")
    proc = subprocess.Popen(
        [
            npx, "wrangler", "pages", "dev", "out", "--port", str(crm_port),
            "--binding", "GITHUB_CLIENT_ID=Iv1.mockclientid",
            "--binding", "GITHUB_CLIENT_SECRET=mock-secret",
            "--binding", f"GH_OAUTH_BASE_URL={mock_base}",
            "--binding", f"GH_API_BASE_URL={mock_base}",
            "--binding", "GH_MOCK=1",
        ],
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        env=env,
        stdout=logf,
        stderr=subprocess.STDOUT,
    )

    def hacer_login(cliente: Cliente, code_patch=None):
        """login -> authorize (mock interno minte code) -> callback.
        code_patch=(viejo, nuevo) se aplica a la URL del callback para simular
        code expirado/reusado conservando un state valido."""
        st, headers, _ = cliente.get(f"{base}/api/auth/login?next=/tareas", redirect=False)
        loc = headers.get("Location", "")
        if not loc.startswith("http"):
            return (st, headers, _)
        st2, h2, b2 = cliente.get(loc, redirect=False)
        cb = h2.get("Location", "") if st2 == 302 else ""
        if not cb:
            return (st2, h2, b2)
        if code_patch:
            cb = cb.replace(*code_patch)
        return cliente.get(cb, redirect=False)

    try:
        ok("wrangler pages dev arriba", esperar_puerto(crm_port))
        time.sleep(2)  # warmup de functions

        # --- 1. sin sesion: status falso, escritura 401
        c = Cliente()
        st, _, body = c.get(f"{base}/api/auth/status")
        ok("status sin sesion = logueado:false", st == 200 and json.loads(body)["logueado"] is False, f"{st} {body[:120]}")
        st, _, _ = c.post(f"{base}/api/tareas", {"titulo": "no deberia"})
        ok("POST /api/tareas sin sesion = 401", st == 401, str(st))

        # --- 2. flujo completo con usuario whitelisteado (mock persona 1 = tiag-ops)
        c = Cliente()
        st, headers, body = c.get(f"{base}/api/auth/login?next=/tareas", redirect=False)
        loc = headers.get("Location", "")
        ok(
            "login 302 a authorize (mock interno)",
            st == 302 and "/login/oauth/authorize" in loc and "client_id=Iv1.mockclientid" in loc,
            f"{st} {loc[:140]}",
        )
        state_url = urllib.parse.parse_qs(urllib.parse.urlparse(loc).query).get("state", [""])[0]
        cookie_state = next((x.value for x in c.jar if x.name == "crm_oauth_state"), None)
        ok("cookie crm_oauth_state espejo del state", bool(state_url) and state_url == cookie_state)

        st, headers2, _ = c.get(loc, redirect=False)  # mock authorize: 302 al callback
        cb = headers2.get("Location", "") if st == 302 else ""
        ok("mock authorize devuelve 302 al callback", st == 302 and "/api/auth/callback" in cb and "code=mock-code-" in cb, f"{st} {cb[:120]}")
        st, headers3, body3 = c.get(cb, redirect=False)
        ok(
            "callback crea sesion y vuelve a /tareas",
            st == 302 and headers3.get("Location", "") == "/tareas" and c.sesion_cookie() is not None,
            f"{st} {headers3.get('Location', '')} {motivo(body3) if st != 302 else ''}",
        )

        # --- 3. con sesion: status true, escritura OK
        st, _, body = c.get(f"{base}/api/auth/status")
        ok("status logueado como tiag-ops", st == 200 and json.loads(body) == {"logueado": True, "login": "tiag-ops"}, str(body[:120]))
        st, _, _ = c.post(f"{base}/api/tareas", {"titulo": f"e2e-oauth-{int(time.time())}"})
        ok("POST /api/tareas con sesion = 201", st == 201, str(st))

        # --- 4. bearer de maquina sigue funcionando
        st, _, _ = Cliente().post(f"{base}/api/tareas", {"titulo": "e2e-control"})  # sin cookie ni bearer
        ok("POST sin cookie ni bearer = 401 (control)", st == 401, str(st))
        req = urllib.request.Request(
            f"{base}/api/tareas", data=json.dumps({"titulo": "e2e-bearer"}).encode(),
            headers={"User-Agent": "e2e/1.0", "content-type": "application/json",
                     "authorization": "Bearer dev-token-cambiar"}, method="POST")
        try:
            st_bearer = urllib.request.urlopen(req, timeout=10).status
        except urllib.error.HTTPError as e:
            st_bearer = e.code
        ok("Bearer CRM_TOKEN sigue valido para maquinas", st_bearer == 201, str(st_bearer))

        # --- 5. whitelist: segundo flujo => mock mintea persona 2 (intruso)
        c2 = Cliente()
        st, headers, body = hacer_login(c2)
        ok("usuario fuera de whitelist = denegado", st == 403 and "whitelist" in body.decode(), f"{st} {motivo(body) if st != 403 else ''}")
        ok("sin cookie de sesion tras denegacion", c2.sesion_cookie() is None)

        # --- 6. state invalido (CSRF)
        c3 = Cliente()
        st, _, _ = c3.get(f"{base}/api/auth/callback?code=x&state=fabricado", redirect=False)
        ok("state fabricado sin cookie = 403", st == 403, str(st))

        # --- 6b. replay del callback ya consumido = 403 (state de un solo uso)
        st, _, body = c.get(cb, redirect=False)
        ok("replay callback = 403 (state single-use)", st == 403, f"{st}")

        # --- 7. code invalido (expirado/reusado): state valido + code podrido
        c4 = Cliente()
        st, headers, body = hacer_login(c4, code_patch=("code=mock-code-", "code=codigo-viejo"))
        ok("code reusado = pagina de error", st == 403 and "intercambio" in body.decode(), f"{st} {motivo(body) if st != 403 else ''}")

        # --- 8. logout borra la sesion
        c.post(f"{base}/api/auth/logout")
        st, _, body = c.get(f"{base}/api/auth/status")
        ok("logout: status vuelve a logueado:false", st == 200 and json.loads(body)["logueado"] is False, str(body[:80]))
        st, _, _ = c.post(f"{base}/api/tareas", {"titulo": "post logout"})
        ok("sesion muerta no escribe", st == 401, str(st))

    finally:
        proc.send_signal(signal.SIGTERM)
        try:
            proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=10)
        logf.close()

    fails = [r for r in resultados if not r[1]]
    print("----", flush=True)
    print(f"{len(resultados) - len(fails)}/{len(resultados)} checks OK", flush=True)
    if fails:
        try:
            with open(log_path, encoding="utf-8", errors="replace") as f:
                print("== tail wrangler ==")
                print("\n".join(f.read().splitlines()[-35:]))
        except Exception as e:
            print("(sin logs:", e, ")")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
