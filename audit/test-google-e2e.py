"""E2E del candado global + Google Sign-In contra `wrangler pages dev`.

El canje se testea con credentials "mocktok_<b64(email)>" (rama interna gated por
binding MOCK_GOOGLE=1, inerte en prod). Ejercita: lockout de paginas/assets/APIs,
canje GIS -> sesion, whitelist, logout, bearer de maquina. Puerto aleatorio =>
inmune a zombies de corridas cortadas.
"""
import base64
import http.cookiejar
import json
import os
import shutil
import signal
import socket
import subprocess
import time
import urllib.request
import urllib.error

EMAIL_OK = "tiago@ejemplo.com"
EMAIL_MAL = "intruso@evil.com"
resultados = []


def ok(nombre, cond, detalle=""):
    resultados.append((nombre, bool(cond), detalle))
    print(("PASS " if cond else "FAIL ") + nombre + (f" :: {detalle}" if detalle and not cond else ""), flush=True)


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
    """Permite cookies Secure sobre http://localhost (en prod es https)."""

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

    def get(self, url, redirect=True, headers=None):
        h = {"User-Agent": "e2e/1.0"}
        h.update(headers or {})
        req = urllib.request.Request(url, headers=h)
        if not redirect:
            class SinRedirect(urllib.request.HTTPRedirectHandler):
                def redirect_request(self, *a, **k):
                    return None

            op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar), SinRedirect)
            return self._abrir(op, req)
        return self._abrir(self.op, req)

    def post(self, url, data=None, headers=None, redirect=True):
        body = json.dumps(data).encode() if data is not None else b""
        h = {"User-Agent": "e2e/1.0", "content-type": "application/json"}
        h.update(headers or {})
        req = urllib.request.Request(url, data=body, headers=h, method="POST")
        if not redirect:
            class SinRedirect(urllib.request.HTTPRedirectHandler):
                def redirect_request(self, *a, **k):
                    return None

            op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar), SinRedirect)
            return self._abrir(op, req)
        return self._abrir(self.op, req)

    def sesion_cookie(self):
        for c in self.jar:
            if c.name == "crm_session":
                return c.value
        return None


def mocktok(email: str) -> str:
    return "mocktok_" + base64.b64encode(email.encode()).decode()


def main():
    crm_port = puerto_libre()
    base = f"http://127.0.0.1:{crm_port}"
    env = dict(os.environ)
    env.setdefault("CRM_TOKEN", "dev-token-cambiar")
    npx = shutil.which("npx") or "npx"
    log_path = os.path.join(
        os.environ.get("LOCALAPPDATA", os.path.dirname(os.path.abspath(__file__))),
        "Temp", f"google-e2e-wrangler-{os.getpid()}.log",
    )
    logf = open(log_path, "w", encoding="utf-8")
    proc = subprocess.Popen(
        [
            npx, "wrangler", "pages", "dev", "out", "--port", str(crm_port),
            "--binding", f"GOOGLE_CLIENT_ID=test-client-id",
            "--binding", f"GOOGLE_WHITELIST={EMAIL_OK}",
            "--binding", f"MOCK_GOOGLE=1",
        ],
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        env=env,
        stdout=logf,
        stderr=subprocess.STDOUT,
    )

    try:
        ok("wrangler pages dev arriba", esperar_puerto(crm_port))
        time.sleep(2)  # warmup de functions

        # --- 1. lockout: sin sesion, todo casa en el login
        c = Cliente()
        st, h, body = c.get(f"{base}/")
        ok("/ sin sesion -> login 200", st == 200 and b"Ingres\xe1 con tu cuenta de Google" in body or b"Account de Google" in body or b"Google" in body, f"{st} {body[:80]}")
        st, h, body = c.get(f"{base}/tareas")
        ok("/tareas sin sesion -> login", st == 200 and b"g_id_onload" in body, f"{st}")
        st, h, body = c.get(f"{base}/api/overview")
        ok("/api/overview sin sesion -> 401", st == 401, str(st))
        st, h, body = c.get(f"{base}/favicon.ico")
        ok("favicon abierto", st == 200, str(st))
        st, h, body = c.get(f"{base}/api/auth/status")
        ok("status abierto = logueado:false", st == 200 and json.loads(body)["logueado"] is False, str(body[:60]))

        # --- 2. canje GIS valido -> sesion + redirect
        st, h, body = c.post(f"{base}/api/auth/google", {"credential": mocktok(EMAIL_OK), "next": "/tareas"}, redirect=False)
        ok("canje GIS ok -> 302 a /tareas", st == 302 and h.get("Location") == "/tareas", f"{st} {h.get('Location')}")
        ok("cookie de sesion puesta", c.sesion_cookie() is not None)

        # --- 3. con sesion: todo pasa
        st, h, body = c.get(f"{base}/api/auth/status")
        ok("status logueado con email", st == 200 and json.loads(body) == {"logueado": True, "email": EMAIL_OK}, str(body[:80]))
        st, h, body = c.get(f"{base}/")
        ok("/ con sesion -> dashboard", st == 200 and b"Dashboard" in body, f"{st}")
        st, h, body = c.get(f"{base}/api/overview")
        ok("/api/overview con sesion -> 200", st == 200, str(st))

        # --- 4. bearer de maquina sigue pasando (sin cookie)
        st, h, body = Cliente().get(f"{base}/api/overview", )
        ok("API sin nada -> 401 (control)", st == 401, str(st))
        st, h, body = Cliente().get(f"{base}/api/overview", headers={"authorization": f"Bearer {env['CRM_TOKEN']}"})
        ok("Bearer CRM_TOKEN pasa para maquinas", st == 200, str(st))

        # --- 5. whitelist deniega
        c2 = Cliente()
        st, h, body = c2.post(f"{base}/api/auth/google", {"credential": mocktok(EMAIL_MAL), "next": "/"})
        ok("email fuera de whitelist = 403", st == 403 and b"whitelist" in body, f"{st}")
        ok("sin sesion tras denegacion", c2.sesion_cookie() is None)

        # --- 6. credential invalido
        c3 = Cliente()
        st, h, body = c3.post(f"{base}/api/auth/google", {"credential": "garbage", "next": "/"})
        ok("credential invalido = 403", st == 403, str(st))
        st, h, body = c3.post(f"{base}/api/auth/google", {"next": "/"})
        ok("sin credential = 400", st == 400, str(st))

        # --- 7. next peligroso ignorado
        st, h, body = c.post(f"{base}/api/auth/google", {"credential": mocktok(EMAIL_OK), "next": "https://mal.com"}, redirect=False)
        ok("next protocol-relative ignorado", st == 302 and h.get("Location") == "/", f"{st} {h.get('Location')}")

        # --- 8. logout borra la sesion
        c.post(f"{base}/api/auth/logout")
        st, h, body = c.get(f"{base}/api/auth/status")
        ok("logout: status logueado:false", st == 200 and json.loads(body)["logueado"] is False, str(body[:60]))
        st, h, body = c.get(f"{base}/api/overview")
        ok("sesion muerta -> 401", st == 401, str(st))

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
