"""Firebase istemcisi — Auth REST (email/parola) + RTDB REST yazma.

Köprü, takıma 'editor' olarak eklenmiş bir 'bot' hesabıyla giriş yapar,
idToken alır ve teams/{tid}/live/{rid} düğümüne yazar. Token ~1 saatte dolar;
otomatik yenilenir. Sadece `requests` gerekir.
"""
import time
import requests

_ID_URL = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword"
_TOK_URL = "https://securetoken.googleapis.com/v1/token"


class FirebaseClient:
    def __init__(self, api_key, database_url, email, password):
        self.api_key = api_key
        self.db = database_url.rstrip("/")
        self.email = email
        self.password = password
        self._id = None
        self._refresh = None
        self._exp = 0.0
        self.uid = None  # giriş sonrası gerçek Firebase UID (localId) — Console'dan okumaya gerek kalmasın

    def sign_in(self):
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

    def _ensure_token(self):
        if not self._id:
            self.sign_in()
            return
        if time.time() < self._exp:
            return
        # süresi doluyor → yenile
        r = requests.post(
            f"{_TOK_URL}?key={self.api_key}",
            data={"grant_type": "refresh_token", "refresh_token": self._refresh},
            timeout=15,
        )
        if r.status_code != 200:
            self.sign_in()
            return
        d = r.json()
        self._id = d["id_token"]
        self._refresh = d["refresh_token"]
        self._exp = time.time() + int(d.get("expires_in", 3600)) - 60

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
        self._ensure_token()
        url = f"{self.db}/teams/{tid}/live/{rid}.json?auth={self._id}"
        r = requests.get(url, timeout=15)
        if r.status_code >= 400:
            raise RuntimeError(f"Okuma hatası: {r.status_code} {r.text[:200]}")
        return r.json()

    # ---- canlı yazma kilidi (lease) — teams/{tid}/livelock/{rid} = {uid, by, ts} ----
    # Aynı yarışa aynı anda birden çok köprü yazarsa titreme olur. Yazmadan önce bu
    # kilit ETag compare-and-set ile alınır; kilit boş/bayat/bizimse alırız, başka
    # taze kilit varsa yazmayız. Süren PC oyunu kapatınca (bırakma + bayatlama) devir
    # otomatik geçer. RTDB REST'te transaction yok → koşullu istek (X-Firebase-ETag).
    LEASE_MS = 12000

    def _lock_url(self, tid, rid):
        return f"{self.db}/teams/{tid}/livelock/{rid}.json?auth={self._id}"

    def claim_lock(self, tid, rid, lease_ms=LEASE_MS):
        """Kilidi al/yenile. Tuttuysak True; başkası taze tutuyorsa False."""
        self._ensure_token()
        r = requests.get(self._lock_url(tid, rid),
                         headers={"X-Firebase-ETag": "true"}, timeout=15)
        if r.status_code == 401:
            self.sign_in()
            r = requests.get(self._lock_url(tid, rid),
                             headers={"X-Firebase-ETag": "true"}, timeout=15)
        if r.status_code >= 400:
            raise RuntimeError(f"Kilit okunamadı: {r.status_code} {r.text[:200]}")
        etag = r.headers.get("ETag", "null_etag")
        cur = r.json()
        now = int(time.time() * 1000)
        if isinstance(cur, dict):
            holder, ts = cur.get("uid"), cur.get("ts") or 0
            if holder and holder != self.uid and (now - ts) <= lease_ms:
                return False   # başka PC taze kilit tutuyor
        body = {"uid": self.uid, "by": self.email, "ts": now}
        pr = requests.put(self._lock_url(tid, rid), json=body,
                          headers={"if-match": etag}, timeout=15)
        if pr.status_code == 412:
            return False       # yarış: aramızda başkası aldı
        if pr.status_code == 401:
            self.sign_in()
            return self.claim_lock(tid, rid, lease_ms)
        if pr.status_code >= 400:
            raise RuntimeError(f"Kilit yazılamadı: {pr.status_code} {pr.text[:200]}")
        return True

    def release_lock(self, tid, rid):
        """Kilidi bırak (yalnız biz tutuyorsak). Best-effort — hata yutulur."""
        try:
            self._ensure_token()
            r = requests.get(self._lock_url(tid, rid),
                             headers={"X-Firebase-ETag": "true"}, timeout=15)
            etag = r.headers.get("ETag", "null_etag")
            cur = r.json()
            if isinstance(cur, dict) and cur.get("uid") == self.uid:
                requests.delete(self._lock_url(tid, rid),
                                headers={"if-match": etag}, timeout=15)
        except Exception:  # noqa: BLE001
            pass
