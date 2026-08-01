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
# canlı saha (VE + takım + numara) — ilk çalışan kullanılır
STANDINGS_PATHS = ("/rest/watch/standings",)
_ENERGY_KEY = re.compile(r"(virtual.?energy|(^|_)energy|nrg)", re.I)
_NAME_KEY = re.compile(r"(driver.?name|^name$|full.?name)", re.I)


def _get(path, timeout=0.5):
    try:
        with urllib.request.urlopen(BASE + path, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8", "ignore"))
    except Exception:
        return None


def _norm(s):
    """Eşleme için: küçük harf + yalnız harf/rakam (ör. 'Action Express #311:LM' →
    'actionexpress311lm'). vehicleName ↔ katalog desc/vehicle eşlemesinde kullanılır."""
    return re.sub(r"[^a-z0-9]", "", str(s or "").lower())


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
        self.catalog = None         # (by_key, by_driver) — statik araç kataloğu
        self.catalog_at = 0.0
        self.catalog_diag = False
        self.sky = None             # {indeks: oyunun gökyüzü metni} — hava sözlüğü
        self.sky_at = 0.0
        self.flags = None           # YETKİLİ bayrak {flag, yellowSectors} — REST'ten
        self.flags_at = 0.0

    def _load_catalog(self):
        """/rest/sessions/getAllVehicles = statik araç kataloğu (tüm liveryler): temiz
        team + manufacturer + number. Bir kez çekip önbelleğe alır (~60 sn). Lookup
        haritaları: normalize(desc/vehicle/id) ve her sürücü adı → {team,manufacturer,number}."""
        now = time.time()
        if self.catalog is not None and now - self.catalog_at < 60:
            return
        self.catalog_at = now
        data = _get("/rest/sessions/getAllVehicles", timeout=3.0)
        by_key, by_drv = {}, {}
        if isinstance(data, list):
            for c in data:
                if not isinstance(c, dict):
                    continue
                info = {
                    "team": str(c.get("team") or c.get("fullTeam") or "").strip(),
                    "manufacturer": str(c.get("manufacturer") or "").strip(),
                    "number": c.get("number"),
                }
                if not (info["team"] or info["manufacturer"]):
                    continue
                for k in ("desc", "vehicle", "id"):
                    v = _norm(c.get(k))
                    if v:
                        by_key[v] = info
                for d in (c.get("drivers") or []):
                    nm = d.get("name") if isinstance(d, dict) else None
                    if nm:
                        by_drv[str(nm).strip().lower()] = info
        self.catalog = (by_key, by_drv)
        if not self.catalog_diag:
            self.catalog_diag = True
            import sys
            n = len(data) if isinstance(data, list) else 0
            print(f"[LMU katalog] getAllVehicles: {n} araç, eşleme anahtarı={len(by_key)}, "
                  f"sürücü={len(by_drv)}", file=sys.stderr)

    def lookup(self, vehicle_name, driver):
        """Canlı aracı katalogla eşle → {team, manufacturer, number} (yoksa {})."""
        try:
            self._load_catalog()
        except Exception:
            return {}
        if not self.catalog:
            return {}
        by_key, by_drv = self.catalog
        vn = _norm(vehicle_name)
        if vn and vn in by_key:
            return by_key[vn]
        dn = str(driver or "").strip().lower()
        if dn and dn in by_drv:
            return by_drv[dn]
        # kısmi: vehicleName bir katalog anahtarını içeriyor/önekliyor (sürüm eki vb.)
        if vn and len(vn) >= 6:
            for k, info in by_key.items():
                if k and (vn.startswith(k) or k.startswith(vn) or k in vn):
                    return info
        return {}

    @staticmethod
    def parse_sky_labels(data):
        """/rest/sessions/weather yanıtı → {gökyüzü_indeksi: OYUNUN KENDİ METNİ}. SAF.

        Neden: paylaşımlı bellek yağışı yalnız 0..1 sayı olarak verir (`mRaining`);
        "Light Rain / Heavy Rain" gibi isimler orada YOK. Ama hava kurulum ekranının
        beslediği bu endpoint her düğüm için `WNV_SKY: {currentValue, stringValue}`
        döndürür ve `stringValue` oyunun kendi etiketidir → sözlüğü tahmin etmek yerine
        oyundan okuyabiliriz. Yanıt şekli: {SEANS: {DÜĞÜM: {WNV_*: {...}}}} (PRACTICE/
        QUALIFY/RACE × START/NODE_25/…/FINISH). Şekil değişirse boş döner (çökmez)."""
        out = {}
        if not isinstance(data, dict):
            return out
        for sess in data.values():
            if not isinstance(sess, dict):
                continue
            for node in sess.values():
                sky = node.get("WNV_SKY") if isinstance(node, dict) else None
                if not isinstance(sky, dict):
                    continue
                lbl = str(sky.get("stringValue") or "").strip()
                try:
                    idx = int(float(sky.get("currentValue")))
                except (TypeError, ValueError):
                    continue
                if lbl:
                    out[idx] = lbl
        return out

    def sky_labels(self):
        """Oyunun gökyüzü/yağış sözlüğü — {indeks: metin}. Bir kez çekilip önbelleğe
        alınır (katalog deseni); REST kapalıysa boş döner. Yalnız teşhis/doğrulama
        için — canlı akışa girmez."""
        now = time.time()
        if self.sky is not None and now - self.sky_at < 60:
            return self.sky
        self.sky_at = now
        try:
            self.sky = self.parse_sky_labels(_get("/rest/sessions/weather", timeout=3.0))
        except Exception:
            self.sky = {}
        return self.sky

    def _pick_list(self, data):
        """Yanıttan araç listesini çıkar (doğrudan liste ya da içindeki bir liste alanı)."""
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for v in data.values():
                if isinstance(v, list) and v and isinstance(v[0], dict):
                    return v
        return []

    @staticmethod
    def parse_standings(cars):
        """standings listesi → ({sürücü_küçük: {ve, team, number}}, own_ve). SAF —
        ağ yok, test edilebilir (bridge/test_lmu_api.py).

        VE birimi toleranslı: veFraction 0..1 → ×100; 1..100 → zaten yüzde; bunların
        dışında/eksik/geçersizse toleranslı `_energy_of` yedeği. (Eskiden yedek yalnız
        float() İSTİSNA atarsa çalışıyordu; sayısal ama aralık dışı bir değer VE'yi
        elde veri olsa bile sessizce None yapıyordu.)"""
        by_driver, own_ve = {}, None
        for c in cars:
            if not isinstance(c, dict):
                continue
            nm = c.get("driverName")
            if not (isinstance(nm, str) and nm.strip()):
                _, nm = _find(c, _NAME_KEY)          # yedek: adı 'name' içeren alan
            ve = None
            try:
                vf = float(c.get("veFraction"))
            except (TypeError, ValueError):
                vf = None
            if vf is not None and 0.0 <= vf <= 1.0:
                ve = round(vf * 100, 1)
            elif vf is not None and 1.0 < vf <= 100.0:
                ve = round(vf, 1)                    # yüzde olarak gelmiş
            if ve is None:
                ve = _energy_of(c)                   # toleranslı yedek
            info = {
                "ve": ve,
                "team": str(c.get("fullTeamName") or c.get("teamName") or "").strip(),
                "number": (str(c.get("carNumber")).strip()
                           if c.get("carNumber") not in (None, "") else None),
            }
            if isinstance(nm, str) and nm.strip():
                by_driver[nm.strip().lower()] = info
            if c.get("player") or c.get("isPlayer") or c.get("hasFocus"):
                own_ve = ve if ve is not None else own_ve
        return by_driver, own_ve

    def standings(self):
        """/rest/watch/standings → canlı saha: her araç için virtual energy (veFraction),
        gerçek takım adı (fullTeamName) ve numara (carNumber). Sürücü adıyla eşlenir.
        Döner: ({sürücü_küçük: {ve, team, number}}, own_ve). veFraction 0..1 → %.
        Kesin şekle göre parse; alan adı değişmişse toleranslı yedek (energy/name)."""
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
        cars = self._pick_list(data)
        self.cache = self.parse_standings(cars)
        if not self.diag_done:
            self.diag_done = True
            self._diag(cars)
        return self.cache

    def _diag(self, cars):
        import sys
        if not cars:
            print("[LMU REST] standings yanıtı yok/boş — REST kapalı veya endpoint farklı "
                  f"(denenen: {', '.join(STANDINGS_PATHS)})", file=sys.stderr)
            return
        keys = list(cars[0].keys()) if isinstance(cars[0], dict) else []
        print(f"[LMU REST] standings endpoint={self.path} araç={len(cars)} "
              f"| ilk kayıt anahtarları: {keys}", file=sys.stderr)

    @staticmethod
    def parse_session_flags(data):
        """/rest/watch/sessionInfo yanıtı → {flag, yellowSectors} ya da None. SAF —
        ağ yok, test edilebilir (bridge/test_lmu_api.py).

        Neden: paylaşımlı bellek `mSectorFlag` LMU'da GREEN iken de bütün sektörleri
        sarı gösterip yanlış 'full yellow' üretiyor (güvenilmez). Bu endpoint YETKİLİ:
          * GamePhase (float)      — 6 ⇒ FCY (tam pist)
          * YellowFlagState (str)  — 'NoFlag/None/Invalid' DIŞI bir durum ⇒ FCY süreci
          * SectorFlag ([]str)     — her parça sarı-ish ise o sektör (konumsal S1..S3)
        Alan adı büyük/küçük kayabilir → toleranslı arama. Hiçbiri yoksa None (bu
        endpoint gelmemiş → çağıran shmem yedeğine düşer)."""
        if not isinstance(data, dict):
            return None
        low = {k.lower(): v for k, v in data.items() if isinstance(k, str)}

        def g(name):
            return data.get(name, low.get(name.lower()))

        phase, yellow, sectors = g("GamePhase"), g("YellowFlagState"), g("SectorFlag")
        if phase is None and yellow is None and sectors is None:
            return None                      # sessionInfo değil / boş

        _GREEN = ("", "green", "no", "none", "noflag", "no_flag", "nogreen",
                  "clear", "invalid", "-1", "0")

        def is_yellow_word(s):
            s = str(s or "").strip().lower()
            return s not in _GREEN and (
                "yellow" in s or "caution" in s or "fcy" in s or "full" in s)

        def is_fcy_state(s):
            return str(s or "").strip().lower() not in _GREEN

        try:
            ph = int(float(phase)) if phase is not None else -1
        except (TypeError, ValueError):
            ph = -1
        ysec = [i + 1 for i, sv in enumerate(list(sectors)[:3])
                if is_yellow_word(sv)] if isinstance(sectors, (list, tuple)) else []
        if ph == 6 or is_fcy_state(yellow):
            return {"flag": "FCY", "yellowSectors": ysec}
        return {"flag": "Yellow" if ysec else "Green", "yellowSectors": ysec}

    def session_flags(self):
        """YETKİLİ bayrak — /rest/watch/sessionInfo. Döner: {flag, yellowSectors} ya da
        REST kapalı/parse edilemezse None (çağıran shmem yedeğine düşer). ~0.5 sn
        throttle (bayrak canlı gelmeli ama her kareyi vurmaya gerek yok)."""
        now = time.time()
        if now - self.flags_at < 0.5:
            return self.flags
        self.flags_at = now
        try:
            self.flags = self.parse_session_flags(
                _get("/rest/watch/sessionInfo", timeout=0.5))
        except Exception:
            self.flags = None
        return self.flags
