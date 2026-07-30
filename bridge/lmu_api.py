"""LMU yerel REST API istemcisi — Virtual Energy (VE).

Le Mans Ultimate, paylaşımlı bellekte OLMAYAN virtual energy'yi kendi yerel HTTP
API'sinde sunar: http://localhost:6397 (oyunda varsayılan açık). Bu modül, tüm
araçların VE'sini toleranslı biçimde çeker (kesin JSON alan adları LMU sürümüne
göre değişebildiğinden anahtarlar isimden aranır) ve sürücü adıyla eşlenebilecek
bir {sürücü→VE} haritası + kendi araç VE'si döndürür.

Dayanıklı: REST kapalı / oyun yok / endpoint farklı → sessizce boş döner (çökme yok).
İlk başarılı yoklamada bir teşhis satırı üretir (hangi endpoint, VE alanı bulundu mu).
"""
import json
import re
import time
import urllib.request

BASE = "http://127.0.0.1:6397"
# tüm-araç canlı standings + strateji (VE) için denenecek endpoint'ler (ilk çalışan kullanılır)
STANDINGS_PATHS = ("/rest/watch/standings", "/rest/sessions/getAllVehicles",
                   "/rest/race/car")
_ENERGY_KEY = re.compile(r"(virtual.?energy|(^|_)energy|nrg)", re.I)
_NAME_KEY = re.compile(r"(driver.?name|^name$|full.?name)", re.I)


def _get(path, timeout=0.5):
    try:
        with urllib.request.urlopen(BASE + path, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8", "ignore"))
    except Exception:
        return None


def _find(d, rx):
    """dict içinde adı rx ile eşleşen ilk (anahtar, değer) — sığ arama."""
    if isinstance(d, dict):
        for k, v in d.items():
            if isinstance(k, str) and rx.search(k):
                return k, v
    return None, None


def _energy_of(car):
    """Bir araç kaydından VE değeri (0..100) — toleranslı; yoksa None."""
    if not isinstance(car, dict):
        return None
    _, v = _find(car, _ENERGY_KEY)
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    if v <= 0:
        return None
    if v <= 1.0:          # 0..1 kesir olarak gelmişse yüzdeye çevir
        v *= 100.0
    return round(v, 1)


class LmuApi:
    """VE'yi ~1 sn'de bir çeker (localhost ucuz ama throttle güvenli). read()'te
    RF2Source tarafından çağrılır; {sürücü_ad_küçük: ve} + own_ve döndürür."""

    def __init__(self):
        self.path = None            # çalışan standings endpoint (bulununca sabitlenir)
        self.last = 0.0
        self.cache = ({}, None)     # (by_driver, own_ve)
        self.diag_done = False

    def _pick_list(self, data):
        """Yanıttan araç listesini çıkar (doğrudan liste ya da içindeki bir liste alanı)."""
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for v in data.values():
                if isinstance(v, list) and v and isinstance(v[0], dict):
                    return v
        return []

    def fetch(self):
        now = time.time()
        if now - self.last < 1.0:
            return self.cache
        self.last = now
        data = None
        if self.path:
            data = _get(self.path)
        if data is None:
            for p in STANDINGS_PATHS:
                data = _get(p)
                if data is not None:
                    self.path = p
                    break
        by_driver, own_ve = {}, None
        cars = self._pick_list(data)
        found = 0
        for c in cars:
            _, nm = _find(c, _NAME_KEY)
            ve = _energy_of(c)
            if ve is not None:
                found += 1
            if isinstance(nm, str) and nm.strip() and ve is not None:
                by_driver[nm.strip().lower()] = ve
            # kendi araç: isPlayer benzeri bayrak
            if ve is not None and (c.get("isPlayer") or c.get("player")
                                   or c.get("mIsPlayer")):
                own_ve = ve
        self.cache = (by_driver, own_ve)
        if not self.diag_done:
            self.diag_done = True
            self._diag(cars, found)
        return self.cache

    def _diag(self, cars, found):
        import sys
        if not cars:
            print("[LMU REST] yanıt yok / boş — REST kapalı veya endpoint farklı "
                  f"(denenen: {', '.join(STANDINGS_PATHS)})", file=sys.stderr)
            return
        keys = list(cars[0].keys()) if isinstance(cars[0], dict) else []
        print(f"[LMU REST] endpoint={self.path} araç={len(cars)} VE-bulunan={found} "
              f"| ilk kayıt anahtarları: {keys}", file=sys.stderr)
