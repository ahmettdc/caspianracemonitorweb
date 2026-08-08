"""Köprüde KENDİ Google hesabınla giriş — masaüstü uygulamasının (tauriGoogleAuth.js +
lib.rs:exchange_google_code) Python karşılığı. Bot GEREKMEZ.

Akış (yalnız `requests` + stdlib):
  1. PKCE verifier/challenge üret; 127.0.0.1'de rastgele portta loopback HTTP sunucu aç.
  2. Sistem tarayıcısında Google onay sayfasını aç (client_id, redirect=loopback, PKCE,
     scope openid email profile). Google "Desktop app" istemcisi loopback'e izin verir.
  3. Tarayıcı ?code=… ile loopback'e döner → code'u yakala, "sekmeyi kapat" HTML'i bas.
  4. code → oauth2.googleapis.com/token (client_id + client_secret + code_verifier) →
     Google id_token.
  5. Firebase accounts:signInWithIdp → { idToken, refreshToken, localId(uid), email }.
     Bu refreshToken saklanır → sonraki açılışlarda tarayıcı gerekmez (fb.py Google modu).
"""
import base64
import hashlib
import http.server
import secrets
import socket
import threading
import time
import urllib.parse
import webbrowser

import requests

from oauth_config import CLIENT_ID, CLIENT_SECRET, google_enabled

_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_TOKEN_URL = "https://oauth2.googleapis.com/token"
_IDP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp"
_OK_HTML = (
    b"<html><body style='font-family:sans-serif;background:#150E10;color:#F3EAEC'>"
    b"<h3>Giris tamam.</h3><p>Bu sekmeyi kapatip Kopruye donebilirsin.</p></body></html>"
)


def _b64url(raw):
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def pkce_pair():
    """(verifier, challenge) — S256. Saf, test edilebilir."""
    verifier = _b64url(secrets.token_bytes(48))
    challenge = _b64url(hashlib.sha256(verifier.encode()).digest())
    return verifier, challenge


def build_auth_url(client_id, redirect_uri, challenge, state):
    """Google onay URL'i — saf, test edilebilir."""
    return _AUTH_URL + "?" + urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "state": state,
        "prompt": "select_account",
        "access_type": "online",
    })


def _free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


class _Catcher(http.server.BaseHTTPRequestHandler):
    result = {}

    def do_GET(self):  # noqa: N802
        params = {k: v[0] for k, v in
                  urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).items()}
        # YALNIZ code/error taşıyan gerçek redirect'i yakala. Tarayıcı ayrıca
        # /favicon.ico ister → o istek sonucu EZMESİN (aksi halde döngü kodu kaçırır).
        if ("code" in params or "error" in params) and not _Catcher.result:
            _Catcher.result = params
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(_OK_HTML)

    def log_message(self, *a):  # sessiz
        pass


def sign_in_google(api_key, timeout=180, open_browser=True):
    """Tam akışı yürütür → { "refresh_token", "id_token", "uid", "email" } veya hata.
    `google_enabled()` false ise RuntimeError (istemci gömülü değil → bot yolunu kullan)."""
    if not google_enabled():
        raise RuntimeError("Google girişi bu sürümde yapılandırılmadı (bot yolunu kullan).")

    verifier, challenge = pkce_pair()
    state = secrets.token_urlsafe(24)
    port = _free_port()
    redirect_uri = f"http://127.0.0.1:{port}"

    _Catcher.result = {}
    httpd = http.server.HTTPServer(("127.0.0.1", port), _Catcher)
    httpd.timeout = 1
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    try:
        url = build_auth_url(CLIENT_ID, redirect_uri, challenge, state)
        if open_browser:
            webbrowser.open(url)
        deadline = time.time() + timeout
        while time.time() < deadline and "code" not in _Catcher.result and "error" not in _Catcher.result:
            time.sleep(0.3)
    finally:
        httpd.shutdown()

    res = _Catcher.result
    if res.get("error"):
        raise RuntimeError(f"Google reddetti: {res['error']}")
    if res.get("state") != state:
        raise RuntimeError("Güvenlik hatası (state uyuşmadı) — tekrar dene.")
    code = res.get("code")
    if not code:
        raise RuntimeError("Zaman aşımı — tarayıcıda giriş tamamlanmadı.")

    # 4) code → Google id_token
    r = requests.post(_TOKEN_URL, data={
        "code": code, "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET,
        "redirect_uri": redirect_uri, "grant_type": "authorization_code",
        "code_verifier": verifier,
    }, timeout=20)
    if r.status_code != 200:
        raise RuntimeError(f"Google token hatası: {r.status_code} {r.text[:200]}")
    gid = r.json().get("id_token")
    if not gid:
        raise RuntimeError("Google yanıtında id_token yok.")

    # 5) Google id_token → Firebase hesabı (signInWithIdp)
    fr = requests.post(f"{_IDP_URL}?key={api_key}", json={
        "postBody": f"id_token={gid}&providerId=google.com",
        "requestUri": "http://localhost",
        "returnIdpCredential": True,
        "returnSecureToken": True,
    }, timeout=20)
    if fr.status_code != 200:
        raise RuntimeError(f"Firebase giriş hatası: {fr.status_code} {fr.text[:200]}")
    d = fr.json()
    return {
        "refresh_token": d.get("refreshToken"),
        "id_token": d.get("idToken"),
        "uid": d.get("localId"),
        "email": d.get("email", ""),
    }
