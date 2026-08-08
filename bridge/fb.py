"""Firebase istemcisi — Auth REST + RTDB REST yazma/okuma.

İki giriş modu:
  1. **Google (önerilen):** `refresh_token` ile kur → köprü KENDİ Google hesabınla
     yazar (bkz. google_auth.py). Takıma owner/editor olman yeter; bot GEREKMEZ.
  2. **Bot (isteğe bağlı):** e-posta/parola (`signInWithPassword`) — eski yol, korunur.
idToken ~1 saatte dolar; securetoken ile otomatik yenilenir. Sadece `requests` gerekir.
"""
import time
import requests

_ID_URL = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword"
_TOK_URL = "https://securetoken.googleapis.com/v1/token"


class FirebaseClient:
    def __init__(self, api_key, database_url, email=None, password=None, refresh_token=None):
        self.api_key = api_key
        self.db = database_url.rstrip("/")
        self.email = email
        self.password = password
        self.refresh_token = refresh_token  # Google modu: securetoken ile yenilenir
        self._id = None
        self._refresh = refresh_token
        self._exp = 0.0
        self.uid = None    # giriş sonrası gerçek Firebase UID (localId)
        self.mode = "google" if refresh_token else "password"

    def sign_in(self):
        """İlk giriş. Google modunda securetoken ile idToken alır (tarayıcı gerekmez);
        bot modunda e-posta/parola ile."""
        if self.refresh_token:
            self._refresh = self.refresh_token
            self._do_refresh(hard=True)
            return
        r = requests.post(
            f"{_ID_URL}?key={self.api_key}",
            json={"email": self.email, "password": self.password, "returnSecureToken": True},
            timeout=15,
        )
        if r.status_code != 200:
            raise RuntimeError(f"Giriş başarısız: {r.status_code} {r.text[:200]}")
        d = r.json()
        self._id = d["idToken"]
        self._refresh = d["refreshToken"]
        self._exp = time.time() + int(d.get("expiresIn", 3600)) - 60
        self.uid = d.get("localId")

    def _do_refresh(self, hard=False):
        """securetoken refresh → yeni idToken. `hard=True` iken hata fırlatır
        (Google modu; parolaya düşemez)."""
        r = requests.post(
            f"{_TOK_URL}?key={self.api_key}",
            data={"grant_type": "refresh_token", "refresh_token": self._refresh},
            timeout=15,
        )
        if r.status_code != 200:
            if hard:
                raise RuntimeError(
                    f"Oturum yenilenemedi: {r.status_code} {r.text[:200]} "
                    "— köprüde yeniden 'Google ile Giriş' yap.")
            return False
        d = r.json()
        self._id = d["id_token"]
        self._refresh = d["refresh_token"]
        self._exp = time.time() + int(d.get("expires_in", 3600)) - 60
        self.uid = d.get("user_id") or self.uid
        return True

    def _ensure_token(self):
        if not self._id:
            self.sign_in()
            return
        if time.time() < self._exp:
            return
        # süresi doluyor → yenile; bot modunda başarısızsa yeniden giriş
        if not self._do_refresh(hard=False):
            self.sign_in()

    def put_live(self, tid, rid, payload):
        """teams/{tid}/live/{rid} düğümünü tümüyle yazar (PUT)."""
        self._ensure_token()
        url = f"{self.db}/teams/{tid}/live/{rid}.json?auth={self._id}"
        r = requests.put(url, json=payload, timeout=15)
        if r.status_code == 401:
            # token reddedildi → yeniden giriş yap ve bir kez daha dene
            self.sign_in()
            url = f"{self.db}/teams/{tid}/live/{rid}.json?auth={self._id}"
            r = requests.put(url, json=payload, timeout=15)
        if r.status_code >= 400:
            raise RuntimeError(f"Yazma hatası: {r.status_code} {r.text[:200]}")
        return r

    def get_live(self, tid, rid):
        """teams/{tid}/live/{rid} düğümünü okur (REST GET) — selftest için."""
        return self.get_path(f"teams/{tid}/live/{rid}")

    def get_path(self, path):
        """Herhangi bir RTDB yolunu idToken ile okur (GET). Takım/yarış listeleri için."""
        self._ensure_token()
        url = f"{self.db}/{path.strip('/')}.json?auth={self._id}"
        r = requests.get(url, timeout=15)
        if r.status_code >= 400:
            raise RuntimeError(f"Okuma hatası: {r.status_code} {r.text[:200]}")
        return r.json()
