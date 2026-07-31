"""Veri kaynakları → web şeması ({session, own, field}).

İki kaynak:
  * MockSource  — oyun olmadan sahte ama tutarlı bir yarış üretir. Firebase→web
                  boru hattını test etmek için (köprüyü `--mock` ile çalıştır).
  * RF2Source   — rFactor2/LMU paylaşımlı belleğinden okur (pyRfactor2SharedMemory).
                  Alan adları rF2data.h'e dayanır; ilk çalıştırmada kendi
                  makinende doğrula (LMU sürümü offset kaydırabilir → tek nokta).

Şema (web LiveTab ile birebir):
  session: {phase, flag, timeLeftSec, totalLaps, trackTemp, ambientTemp, raining,
            rain, wetness, trackName, trackLength, sessionType}
  own:     {fuel, fuelCapacity, virtualEnergy, position, lastLapSec, bestLapSec,
            curLapSec, s1, s2, lapsDone, inPits, pitStops, location, damage, avg5Sec,
            avgSec, stintSec, tyreCompound:{front,rear},
            tyres:{fl,fr,rl,rr:{wear,tempC,pressKpa}}}
  (virtualEnergy = LMU REST API'den; paylaşımlı bellekte yok. REST kapalıysa gelmez.)
  field[]: {pos, carId, driver, vehicleName, team, manufacturer, number, carClass, lapsDone,
            lapDist, posX, posZ, lastSec, lastSectors:[s1,s2,s3], bestSec, gapSec,
            intervalSec, lapsBehind, lapsBehindNext, inPits, location, pitStops, tyreWear,
            damage, virtualEnergy, avg5Sec, avgSec, stintSec, laps, lapsFrom, lapNums,
            lapKey, isPlayer}
  (lapsBehind/lapsBehindNext = oyunun mLapsBehindLeader/mLapsBehindNext alanları — web
   tur-altı ("+N Tur") göstergesi bunları kullanır; lider-tur eksi araç-tur çıkarması
   lider S/F'yi geçtiği pencerede YANLIŞ "+1 Tur" verirdi.)
  (team/manufacturer/number = LMU araç kataloğundan (getAllVehicles) vehicleName/sürücü
   ile eşlenir — mPitGroup takım adı değil pit-grup no. manufacturer → marka logosu.
   session.sessionType = Antrenman/Sıralama/Yarış…)
  (lapDist/posX/posZ + session.trackLength = trackmap: dış boşluk halkası
   lapDist/trackLength ile, iç pist şekli dünya posX/posZ ile çizilir.)

avg5Sec/avgSec/stintSec ve laps/lapsFrom/lapKey Aggregator (durumlu sarmalayıcı)
tarafından türetilir; RF2Source/MockSource tek-kare okur, Aggregator kare kare geçmiş
biriktirir. laps = köprü çalışırken tamamlanan son ~LAP_LOG_MAX turun süresi (JS taşıma
tamponu); lapNums = bu sürelerin GERÇEK tur numaraları (log boşluklu olabilir: geçersiz
tur atlanır ya da lapsDone >1 atlar → ardışık varsaymak tur kaymasına yol açıyordu);
lapsFrom = ilk elemanın tur numarası (eski sözleşme, geriye uyum); lapKey = ARACIN
Firebase-güvenli anahtarı (carId/mID tabanlı — sürücü adı DEĞİL: pilot değişiminde
aracın geçmişi bölünmesin diye). Köprü JS (liveBridge) bu turları kalıcı append-only düğüme (livelaps/{rid}/
{lapKey}/{n}=sec) tur başına bir kez yazar; canlı kareden laps/lapsFrom çıkarılır ki kare
küçük kalsın. Web "+" → o aracın tüm yarış geçmişini livelaps'ten talep üzerine okur.
"""
import math
import random
import time
from collections import deque

_PHASE = {
    0: "Garaj", 1: "Isınma", 2: "Grid", 3: "Formasyon", 4: "Geri Sayım",
    5: "Yeşil", 6: "FCY", 7: "Durduruldu", 8: "Bitti", 9: "Duraklatıldı",
}


def _flag_of(phase, yellow, sector_flags):
    """Bayrak durumu → (flag, yellowSectors).

    İki AYRI kaynak var ve eskiden yalnız biri okunuyordu:
      * mYellowFlagState — TAM PİST sarısının (FCY) durum makinesi
        (0=yok, 1=Pending, 2=PitClosed, … 7=RaceHalt). >0 ⇒ FCY sürecindeyiz.
      * mSectorFlag[3]  — LOKAL sektör sarıları (kaza/spin). Oyundaki tipik
        "sarı bayrak" budur; okunmadığı için uygulama Green gösteriyordu.
    Index → sektör eşlemesi rF2Sector enum'una göre SIRALI DEĞİL: 0=S3, 1=S1, 2=S2.
    Alanlar c_ubyte: Invalid(-1) → 255 gelir ⇒ makullük şartı 0 < v < 200
    (eskiden `yellow > 0` Invalid'i de sarı sayardı)."""
    sec_no = (3, 1, 2)
    ysec = sorted(sec_no[i] for i, v in enumerate(list(sector_flags or [])[:3])
                  if 0 < int(v) < 200)
    if phase == 6 or 0 < int(yellow) < 200:
        return "FCY", ysec
    return ("Yellow" if ysec else "Green"), ysec

# Satırdaki "+" → tur zaman listesi için sürücü başına saklanan son tur sayısı
# (Firebase yükünü sınırlar; endurance'ta bir-iki stint'i rahat kapsar).
LAP_LOG_MAX = 50


def _session_type(n):
    """mSession → seans tipi etiketi (0=test,1-4=prova,5-8=qual,9=ısınma,10-13=yarış)."""
    if n == 0:
        return "Test"
    if 1 <= n <= 4:
        return "Antrenman"
    if 5 <= n <= 8:
        return "Sıralama"
    if n == 9:
        return "Isınma"
    if 10 <= n <= 13:
        return "Yarış"
    return ""


def _s(b):
    """rF2 byte dizisi → temiz string."""
    try:
        return bytes(b).split(b"\x00", 1)[0].decode("utf-8", "ignore").strip()
    except Exception:
        return ""


def _car_key(row):
    """Bir field satırı → ARACIN kimliği (durum ve lapKey anahtarı).

    Sürücü adı KULLANILMAZ: endurance'ta pilot değişince (driver swap) ad değişir ve
    aracın tur geçmişi/ortalamaları/lapKey'i sıfırlanıp Firebase'de ikiye bölünüyordu
    ("+" listesi yarışın başını kaybediyor, pozisyon grafiğinde araç iki çizgi oluyordu).
    rF2 `mID` (slot ID) pilot değişse de aynı kalır → araç kimliği odur.
    Not: mID çok-oyunculuda biri ayrılınca yeniden kullanılabilir (struct notu).
    carId yoksa (eski akış/mock) sürücü adına düşülür — geriye uyumlu."""
    cid = row.get("carId")
    if isinstance(cid, int) and not isinstance(cid, bool) and cid >= 0:
        return f"c{cid}"
    return row.get("driver") or f"#{row.get('pos')}"


def _fbkey(name):
    """Sürücü adı → Firebase RTDB anahtarı olarak güvenli metin.
    RTDB anahtarında yasak karakterler (. # $ / [ ]) ve boşluk → '_'.
    livelaps/{rid}/{lapKey} yolunda anahtar olarak kullanılır."""
    s = "".join("_" if c in ".#$/[] \t\n" else c for c in str(name or "")).strip("_")
    return s or "arac"


# ----------------------------------------------------------------------------
class MockSource:
    """Oyunsuz test için akla yatkın bir dayanıklılık yarışı simüle eder."""

    NAMES = ["A. Demircan", "M. Yılmaz", "E. Kaya", "S. Öztürk", "C. Aydın",
             "B. Şahin", "K. Arslan", "T. Doğan", "R. Koç", "H. Çelik",
             "N. Aksoy", "F. Polat", "L. Ünal", "V. Taş", "D. Ergün"]
    CLASSES = ["Hypercar", "LMGT3"]
    VEH_HY = ["Toyota GR010 Hybrid", "Ferrari 499P", "Porsche 963"]
    VEH_GT = ["BMW M4 GT3", "Mercedes-AMG GT3", "Ferrari 296 GT3",
              "Porsche 911 GT3 R", "McLaren 720S GT3", "Corvette Z06 GT3.R",
              "Lexus RC F GT3", "Ford Mustang GT3", "Aston Martin Vantage GT3",
              "Lamborghini Huracan GT3", "McLaren 720S GT3", "Ferrari 296 GT3"]
    TEAMS = ["Caspian Motorsport", "Iron Lynx", "Team WRT", "Vista AF Corsa",
             "Manthey", "TF Sport", "Akkodis ASP", "Garage 59", "Proton",
             "Heart of Racing", "The Bend", "Iron Dames", "AO Racing", "Ginetta"]

    def __init__(self, cars=14):
        self.n = min(cars, len(self.NAMES))
        self.t0 = time.time()
        self.base = [88.0 + i * 0.35 + random.random() for i in range(self.n)]  # tur temposu
        self.total = 6 * 3600  # 6 saat

    TRACK_LEN = 4000.0  # sahte pist uzunluğu (m)

    @staticmethod
    def _track_xy(frac):
        """Tur oranı (0..1) → sahte pist üzerinde dünya (x, z) — trackmap testi için
        kıvrımlı kapalı bir devre çizer."""
        a = 2 * math.pi * frac
        x = 700 * math.sin(a) + 250 * math.sin(2 * a)
        z = 500 * math.cos(a) + 180 * math.cos(3 * a)
        return round(x, 1), round(z, 1)

    @staticmethod
    def _manuf(veh):
        """Sahte araç adından marka (katalog manufacturer yerine mock için)."""
        for m in ("Mercedes-AMG", "Aston Martin", "BMW", "Ferrari", "Porsche",
                  "McLaren", "Corvette", "Lexus", "Ford", "Lamborghini", "Toyota"):
            if m.split()[0].lower() in veh.lower():
                return m
        return ""

    def read(self):
        el = time.time() - self.t0
        rows = []
        for i in range(self.n):
            lap_t = self.base[i] + math.sin(el / 30 + i) * 0.4
            laps = int(el / lap_t)
            frac = (el % lap_t) / lap_t          # tur içi ilerleme 0..1
            px, pz = self._track_xy(frac)
            veh = self.VEH_HY[i] if i < 3 else self.VEH_GT[(i - 3) % len(self.VEH_GT)]
            rows.append({
                "pos": 0, "carId": i, "driver": self.NAMES[i],
                "team": self.TEAMS[i % len(self.TEAMS)],
                "vehicleName": veh, "manufacturer": self._manuf(veh), "number": 10 + i,
                "carClass": self.CLASSES[0] if i < 3 else self.CLASSES[1],
                "lapsDone": laps, "lastSec": round(lap_t, 3),
                "lastSectors": [round(lap_t * 0.25, 3), round(lap_t * 0.44, 3),
                                round(lap_t * 0.31, 3)],
                "bestSec": round(self.base[i], 3),
                "_prog": laps * 1e6 + (el % lap_t),  # sıralama için ilerleme
                "inPits": (int(el / 90) % 11) == i, "isPlayer": i == 4,
                "pitStops": laps // 45,  # ~45 turda bir durak
                "tyreWear": round(max(0.15, 1 - (el % 1500 / 1500) * 0.7), 3),
                "damage": round(min(0.4, i * 0.01 + (el % 600) / 6000), 3),
                "lapDist": round(frac * self.TRACK_LEN, 1), "posX": px, "posZ": pz,
                "virtualEnergy": round(max(3.0, 100 - ((el + i * 40) % 1500 / 1500) * 92), 1),
            })
        rows.sort(key=lambda r: -r["_prog"])
        leadprog = rows[0]["_prog"]
        for p, r in enumerate(rows):
            r["pos"] = p + 1
            r["gapSec"] = 0.0 if p == 0 else round((leadprog - r["_prog"]) / 1e6 * r["lastSec"], 1)
            r["intervalSec"] = 0.0 if p == 0 else round(r["gapSec"] - rows[p - 1]["gapSec"], 1)
            # tur-altı: yalnız fark bir TAM turu aşınca (oyunun mLapsBehind* karşılığı)
            _lt = max(1.0, r["lastSec"])
            r["lapsBehind"] = 0 if p == 0 else int(r["gapSec"] // _lt)
            r["lapsBehindNext"] = 0 if p == 0 else int(max(0.0, r["intervalSec"]) // _lt)
            r["location"] = "PIT" if r["inPits"] else "TRACK"
            r.pop("_prog", None)
        me = next(r for r in rows if r["isPlayer"])
        stint = el % 1500
        return {
            "session": {
                "phase": "Yeşil",
                # döngü: çoğunlukla Green, ara sıra FCY ya da LOKAL sarı (S2) — UI testi
                "flag": ("FCY" if (int(el / 120) % 10) == 0
                         else "Yellow" if (int(el / 120) % 10) == 5 else "Green"),
                "yellowSectors": [2] if (int(el / 120) % 10) == 5 else [],
                "timeLeftSec": max(0, int(self.total - el)), "totalLaps": 0,
                "trackTemp": round(30 + math.sin(el / 300) * 4, 1),
                "ambientTemp": round(22 + math.sin(el / 400) * 2, 1),
                "raining": (int(el / 200) % 5) == 4,
                "rain": max(0, int(60 * math.sin(el / 200)) if (int(el / 200) % 5) == 4 else 0),
                "wetness": max(0, min(100, int(40 + 30 * math.sin(el / 250)))),
                "trackName": "Mock Circuit",
                "trackLength": self.TRACK_LEN,
                "sessionType": "Antrenman",
            },
            "own": {
                "fuel": round(max(2, 78 - (stint / 1500) * 70), 1), "fuelCapacity": 78.0,
                "virtualEnergy": me["virtualEnergy"],
                "team": me["team"], "vehicleName": me["vehicleName"],
                "manufacturer": me["manufacturer"], "number": me["number"],
                "position": me["pos"], "lastLapSec": me["lastSec"], "bestLapSec": me["bestSec"],
                "curLapSec": round(stint % me["lastSec"], 1), "s1": round(me["lastSec"] * 0.32, 3),
                "s2": round(me["lastSec"] * 0.35, 3), "s3": round(me["lastSec"] * 0.33, 3),
                "lapsDone": me["lapsDone"],
                "inPits": me["inPits"], "pitStops": me["pitStops"],
                "location": me["location"], "damage": me["damage"],
                "control": 0, "driving": True,   # mock: bu PC aktif sürücü (yazar)
                "tyreCompound": (lambda comp: {"front": comp, "rear": comp})(
                    ["Medium", "Hard", "Soft"][int(el / 1500) % 3]),
                "tyres": {c: {"wear": round(max(0.2, 1 - (stint / 1500) * 0.7), 3),
                              "tempC": round(82 + random.random() * 12, 0),
                              "pressKpa": round(165 + random.random() * 8, 0)}
                          for c in ("fl", "fr", "rl", "rr")},
            },
            "field": rows,
            "_diag": {"shm": True, "cars": len(rows), "lmu": True,
                      "ve": sum(1 for r in rows if r.get("virtualEnergy") is not None)},
        }


# ----------------------------------------------------------------------------
class RF2Source:
    """LMU/rF2 paylaşımlı bellek okuyucu (pyRfactor2SharedMemory üzerinden).

    Not: alan adları rF2data.h ile eşleşir. Eksik/kaymış alanları çökmeden
    atlamak için erişimler `getattr` ile korunur.
    """

    def __init__(self):
        # Bağımlılık yalnız burada; --mock modunda hiç import edilmez.
        from pyRfactor2SharedMemory.sharedMemoryAPI import SimInfoAPI  # noqa
        self.api = SimInfoAPI()
        # Virtual Energy paylaşımlı bellekte yok → LMU yerel REST API'den (opsiyonel)
        try:
            from lmu_api import LmuApi
            self.lmu = LmuApi()
        except Exception:
            self.lmu = None

    def close(self):
        try:
            self.api.close()
        except Exception:
            pass

    @staticmethod
    def _tyre_c(w):
        """Lastik İÇ sıcaklığı → °C. Öncelik: mTireCarcassTemperature (karkas) →
        mTireInnerLayerTemperature (iç kauçuk katmanı) ort. → mTemperature (yüzey) ort.
        Pit duvarı için anlamlı olan iç/karkas sıcaklığıdır (LMU HUD ile uyumlu);
        yüzey sıcaklığı anlık ve oynaktır — eskiden önce o okunuyordu (kullanıcı isteği).
        rF2 alanları Kelvin; oyun doldurmadıysa 0 gelir (0 K → -273°C saçmalığı) →
        makul (K > 200 ≈ -73°C) değer C'ye çevrilir; hiçbiri makul değilse None."""
        carc = float(getattr(w, "mTireCarcassTemperature", 0.0) or 0.0)
        if carc > 200:
            return round(carc - 273.15, 0)
        for field in ("mTireInnerLayerTemperature", "mTemperature"):
            vals = [float(t) for t in getattr(w, field, []) or []]
            vals = [v for v in vals if v > 200]        # 0/başlatılmamış'ı ele
            if vals:
                return round(sum(vals) / len(vals) - 273.15, 0)
        return None

    @classmethod
    def _wheels(cls, tele):
        out = {}
        keys = ("fl", "fr", "rl", "rr")
        for i, k in enumerate(keys):
            try:
                w = tele.mWheels[i]
                press = float(getattr(w, "mPressure", 0.0) or 0.0)
                out[k] = {
                    "wear": round(float(getattr(w, "mWear", 0.0)), 3),
                    "tempC": cls._tyre_c(w),
                    "pressKpa": round(press, 0) if press > 0 else None,
                }
            except Exception:
                out[k] = {}
        return out

    @staticmethod
    def _worst_wear(tele):
        """4 tekerin en kötü (en düşük) diş oranı 0..1 — saha lastik göstergesi."""
        try:
            ws = [float(getattr(tele.mWheels[i], "mWear", 1.0)) for i in range(4)]
            return round(min(ws), 3) if ws else None
        except Exception:
            return None

    @staticmethod
    def _damage(tele):
        """mDentSeverity (her biri 0..2) → 0..1 hasar oranı."""
        try:
            dents = list(getattr(tele, "mDentSeverity", []))
            return round(sum(int(d) for d in dents) / (len(dents) * 2.0), 3) if dents else None
        except Exception:
            return None

    @staticmethod
    def _sectors(v):
        """Son tamamlanan turun S1/S2/S3 (kümülatif DEĞİL). rF2: mLastSector2 = S1+S2
        kümülatif. s3 = son tur − S1+S2. Makul değilse [None,None,None] (tur yoksa)."""
        try:
            s1 = float(getattr(v, "mLastSector1", -1.0))
            s12 = float(getattr(v, "mLastSector2", -1.0))       # kümülatif S1+S2
            lap = float(getattr(v, "mLastLapTime", -1.0))
            if s1 > 0 and s12 > s1 and lap > s12:
                return [round(s1, 3), round(s12 - s1, 3), round(lap - s12, 3)]
        except Exception:
            pass
        return [None, None, None]

    @staticmethod
    def _pos(v):
        """Aracın dünya (x, z) konumu (m) — trackmap iç pist şekli için. y yükseklik."""
        try:
            mp = getattr(v, "mPos", None)
            if mp is None:
                return None, None
            return round(float(mp.x), 1), round(float(mp.z), 1)
        except Exception:
            return None, None

    @staticmethod
    def _location(v):
        """Aracın konumu: GARAGE / PIT / TRACK."""
        if bool(getattr(v, "mInGarageStall", 0)):
            return "GARAGE"
        if bool(getattr(v, "mInPits", 0)) or int(getattr(v, "mPitState", 0)) in (2, 3, 4):
            return "PIT"
        return "TRACK"

    @staticmethod
    def _stable_copy(live):
        """Paylaşımlı bellekten TUTARLI anlık kopya. `from_buffer` canlı görünümdür:
        oyun tam yazarken okunan kare YIRTIK olabilir (ör. lapsDone bir anlığına düşük
        görünür → Aggregator 'yeni seans' sanıp geçmişi sıfırlar → AVG yanıp söner).
        rF2SMMP bunun için mVersionUpdateBegin/End sayaçlarını sunar: yazım sırasında
        begin != end. Kopyala, sayaçlar eşitse kabul et; değilse birkaç kez dene
        (TinyPedal tekniği). Son deneme de yırtıksa yine KOPYA döner — en azından kare
        işlenirken veri altımızdan değişmez."""
        snap = None
        for _ in range(6):
            snap = type(live).from_buffer_copy(live)
            try:
                if int(snap.mVersionUpdateBegin) == int(snap.mVersionUpdateEnd):
                    return snap
            except Exception:
                return snap    # sayaç alanı yoksa (eski struct) kopya yeterli
        return snap

    def read(self):
        scor = self._stable_copy(self.api.Rf2Scor)
        tele = self._stable_copy(self.api.Rf2Tele)
        ext = getattr(self.api, "Rf2Ext", None)
        info = scor.mScoringInfo
        num = int(getattr(info, "mNumVehicles", 0))

        # seans
        cur, end = float(info.mCurrentET), float(info.mEndET)
        phase = int(getattr(info, "mGamePhase", 0))
        yellow = int(getattr(info, "mYellowFlagState", 0))
        flag, ysec = _flag_of(phase, yellow, getattr(info, "mSectorFlag", []))
        maxlaps = int(getattr(info, "mMaxLaps", 0))
        session = {
            "phase": _PHASE.get(phase, str(phase)), "flag": flag,
            "yellowSectors": ysec,   # lokal sarı olan sektörler (ör. [2]) — UI eki
            "timeLeftSec": max(0, int(end - cur)) if end > 0 else None,
            "totalLaps": maxlaps if 0 < maxlaps < 30000 else 0,
            "trackTemp": round(float(getattr(info, "mTrackTemp", 0.0)), 1),
            "ambientTemp": round(float(getattr(info, "mAmbientTemp", 0.0)), 1),
            "raining": float(getattr(info, "mRaining", 0.0)) > 0.1,
            # yağmur şiddeti % (mRaining 0..1) ve zemin ıslaklığı % (mAvgPathWetness 0..1)
            "rain": round(max(0.0, min(1.0, float(getattr(info, "mRaining", 0.0)))) * 100),
            "wetness": round(max(0.0, min(1.0, float(getattr(info, "mAvgPathWetness", 0.0)))) * 100),
            # pist adı — paylaşımlı iç-harita şekli bu ada göre anahtarlanır (pist başına)
            "trackName": _s(getattr(info, "mTrackName", b"")) or None,
            # pist uzunluğu (m) — trackmap dış boşluk halkası için (lapDist/trackLength)
            "trackLength": round(float(getattr(info, "mLapDist", 0.0)), 1) or None,
            "sessionType": _session_type(int(getattr(info, "mSession", -1))),
        }

        # telemetriyi mID ile eşle (saha başına lastik aşınması + hasar için)
        tele_by_id = {}
        for i in range(min(num, len(tele.mVehicles))):
            tv = tele.mVehicles[i]
            tele_by_id[int(getattr(tv, "mID", -1))] = tv

        # saha (scoring + eşleşen telemetri)
        field, player_scor = [], None
        for i in range(min(num, len(scor.mVehicles))):
            v = scor.mVehicles[i]
            is_player = bool(getattr(v, "mIsPlayer", 0))
            if is_player:
                player_scor = v
            tv = tele_by_id.get(int(getattr(v, "mID", -2)))
            px, pz = self._pos(v)
            field.append({
                "pos": int(getattr(v, "mPlace", 0)),
                # ARAÇ kimliği (slot ID) — sürücü adı endurance'ta pilot değişiminde
                # değişir; tur geçmişi/ortalama/lapKey buna değil buna bağlanmalı.
                "carId": int(getattr(v, "mID", -1)),
                "driver": _s(getattr(v, "mDriverName", b"")),
                "vehicleName": _s(getattr(v, "mVehicleName", b"")),
                "carClass": _s(getattr(v, "mVehicleClass", b"")),
                "lapsDone": int(getattr(v, "mTotalLaps", 0)),
                "lapDist": round(float(getattr(v, "mLapDist", 0.0)), 1),
                "posX": px, "posZ": pz,
                "lastSec": round(float(getattr(v, "mLastLapTime", -1.0)), 3),
                "lastSectors": self._sectors(v),   # [S1,S2,S3] (popup tur listesi)
                "bestSec": round(float(getattr(v, "mBestLapTime", -1.0)), 3),
                "gapSec": round(float(getattr(v, "mTimeBehindLeader", 0.0)), 1),
                "intervalSec": round(float(getattr(v, "mTimeBehindNext", 0.0)), 1),
                # Tur-altı: oyunun YETKİLİ alanları. lider/araç tur sayısını çıkarmak
                # yanlış "+1 Tur" verir (lider S/F'yi geçip diğeri geçmeden önceki
                # pencerede aynı turdaki araç tur-altı görünür).
                "lapsBehind": int(getattr(v, "mLapsBehindLeader", 0) or 0),
                "lapsBehindNext": int(getattr(v, "mLapsBehindNext", 0) or 0),
                "inPits": bool(getattr(v, "mInPits", 0)),
                "location": self._location(v),
                "pitStops": int(getattr(v, "mNumPitstops", 0)),
                "tyreWear": self._worst_wear(tv) if tv is not None else None,
                "damage": self._damage(tv) if tv is not None else None,
                "isPlayer": is_player,
            })
        field.sort(key=lambda r: r["pos"] if r["pos"] > 0 else 999)

        # kendi araç (player telemetry + scoring)
        # Telemetriyi oyuncunun mID'siyle eşle (en güvenilir); yoksa telemetride
        # mIsPlayer ara. mVehicles[0]'a DÜŞME — o lider araç olur, yanlış veri verir.
        own = None
        pt = None
        if player_scor is not None:
            pt = tele_by_id.get(int(getattr(player_scor, "mID", -2)))
        if pt is None:
            for i in range(min(num, len(tele.mVehicles))):
                if bool(getattr(tele.mVehicles[i], "mIsPlayer", 0)):
                    pt = tele.mVehicles[i]
                    break
        if pt is not None:
            own = {
                "fuel": round(float(getattr(pt, "mFuel", 0.0)), 1),
                "fuelCapacity": round(float(getattr(pt, "mFuelCapacity", 0.0)), 1) or None,
                "tyreCompound": {
                    "front": _s(getattr(pt, "mFrontTireCompoundName", b"")) or None,
                    "rear": _s(getattr(pt, "mRearTireCompoundName", b"")) or None,
                },
                "damage": self._damage(pt),
                "tyres": self._wheels(pt),
            }
            if player_scor is not None:
                own.update({
                    "vehicleName": _s(getattr(player_scor, "mVehicleName", b"")),
                    "position": int(getattr(player_scor, "mPlace", 0)),
                    "lastLapSec": round(float(getattr(player_scor, "mLastLapTime", -1.0)), 3),
                    "bestLapSec": round(float(getattr(player_scor, "mBestLapTime", -1.0)), 3),
                    "curLapSec": round(float(getattr(player_scor, "mTimeIntoLap", 0.0)), 1),
                    # mCurSector2 KÜMÜLATİF (S1+S2) → s2 arındırılır; s3 = son turun
                    # S3'ü (_sectors) — kart S1/S2/S3'ü tekil süreler olarak gösterir.
                    "s1": round(float(getattr(player_scor, "mCurSector1", -1.0)), 3),
                    "s2": (lambda c1, c2: round(c2 - c1, 3) if c1 > 0 and c2 > c1 else -1.0)(
                        float(getattr(player_scor, "mCurSector1", -1.0)),
                        float(getattr(player_scor, "mCurSector2", -1.0))),
                    "s3": self._sectors(player_scor)[2] or -1.0,
                    "lapsDone": int(getattr(player_scor, "mTotalLaps", 0)),
                    "inPits": bool(getattr(player_scor, "mInPits", 0)),
                    "pitStops": int(getattr(player_scor, "mNumPitstops", 0)),
                    "location": self._location(player_scor),
                    # arabayı kim sürüyor: 0=yerel oyuncu, 1=AI, 2=uzak, 3=replay,
                    # 255=yok (c_ubyte). driving=True → bu PC aktif sürücü → tek-yazıcı
                    # seçiminde (livewriter lease) kirayı önceliklendirir.
                    "control": int(getattr(player_scor, "mControl", 255)),
                    "driving": int(getattr(player_scor, "mControl", 255)) == 0,
                })

        # Virtual Energy — LMU REST API'den (paylaşımlı bellekte yok); toleranslı,
        # sürücü adıyla eşlenir. REST kapalı/farklıysa sessizce atlanır.
        lmu_ok = False
        if getattr(self, "lmu", None) is not None:
            try:
                by_driver, own_ve = self.lmu.standings()
                lmu_ok = bool(by_driver)
            except Exception:
                by_driver, own_ve = {}, None

            def _apply(rec, drv):
                # canlı standings: VE + gerçek takım (oyuncu/custom dahil) + numara
                st = by_driver.get(str(drv or "").strip().lower()) or {}
                if st.get("ve") is not None:
                    rec["virtualEnergy"] = st["ve"]
                if st.get("team"):
                    rec["team"] = st["team"]
                if st.get("number"):
                    rec["number"] = st["number"]
                # marka: araç kataloğundan (vehicleName ile); takım/numara yedek
                cat = self.lmu.lookup(rec.get("vehicleName"), drv)
                if cat.get("manufacturer"):
                    rec["manufacturer"] = cat["manufacturer"]
                if not rec.get("team") and cat.get("team"):
                    rec["team"] = cat["team"]
                if rec.get("number") is None and cat.get("number") is not None:
                    rec["number"] = str(cat["number"])

            for r in field:
                _apply(r, r.get("driver"))
            if own is not None:
                pdrv = _s(getattr(player_scor, "mDriverName", b"")) \
                    if player_scor is not None else ""
                _apply(own, pdrv)
                if own.get("virtualEnergy") is None and own_ve is not None:
                    own["virtualEnergy"] = own_ve

        # Gizli teşhis (_diag): köprü sağlığı — arayüzde GÖSTERİLMEZ, Firebase'e
        # YAZILMAZ (liveBridge.js kareden siler); yalnız yerel konsol/tooltip için.
        # shm=paylaşımlı bellek okundu, cars=araç sayısı, lmu=LMU REST yanıtı,
        # ve=VE gelen araç sayısı. "VE gelmiyor / veri yok" teşhisini kolaylaştırır.
        diag = {
            "shm": True,   # read() buraya ulaştıysa paylaşımlı bellek eşlendi
            "cars": len(field),
            "lmu": lmu_ok,
            "ve": sum(1 for r in field if r.get("virtualEnergy") is not None),
            # bayrak ham değerleri — sahada bayrak yine ters düşerse --dump ile
            # alan semantiği buradan doğrulanır (LMU sürümü alanları kaydırabilir)
            "flagRaw": {"phase": phase, "yellow": yellow,
                        "sectors": [int(x) for x in list(getattr(info, "mSectorFlag", []) or [])[:3]]},
        }
        return {"session": session, "own": own, "field": field, "_diag": diag}


# ----------------------------------------------------------------------------
class Aggregator:
    """İç kaynağı (Mock/RF2) sarar; kare kare tur geçmişi + stint durumu tutar,
    her field satırına ve own'a avg5Sec / avgSec / stintSec ekler.
    Anahtar = sürücü adı. Köprü yeniden başlarsa geçmiş sıfırlanır."""

    #: lapsDone gerilemesi kaç ARDIŞIK karede sürerse "yeni seans" sayılır.
    #: Tek karelik düşüşler paylaşımlı bellekten yırtık okuma olabilir (oyun tam
    #: yazarken) — hemen sıfırlamak AVG5/AVG'yi yanıp söndürüyordu.
    REGRESS_FRAMES = 3

    def __init__(self, inner):
        self.inner = inner
        self.hist = {}          # sürücü → deque(son ~30 geçerli lastSec) — avg için
        self.lap_log = {}       # sürücü → deque((lapNo, sec)) — tam tur listesi (popup)
        self.prev_laps = {}     # sürücü → son görülen lapsDone
        self.prev_pits = {}     # sürücü → son görülen inPits
        self.stint_start = {}   # sürücü → stint başlangıcı (time.time())
        self.regress = {}       # sürücü → ardışık gerileme sayacı (yırtık kare filtresi)

    def close(self):
        if hasattr(self.inner, "close"):
            self.inner.close()

    @staticmethod
    def _valid_lap(last, best):
        if not (last and last > 20):
            return False           # geçersiz/çok kısa
        if best and best > 0 and last > best * 1.10:
            return False           # out-lap / pit turu → ortalamayı bozma
        return True

    def read(self):
        data = self.inner.read()
        now = time.time()
        field = data.get("field") or []
        for r in field:
            key = _car_key(r)
            laps = int(r.get("lapsDone") or 0)
            last = float(r.get("lastSec") or 0)
            best = float(r.get("bestSec") or 0)
            in_pits = bool(r.get("inPits"))

            first = key not in self.prev_laps
            regressed = not first and laps < self.prev_laps[key]
            if regressed:
                self.regress[key] = self.regress.get(key, 0) + 1
            else:
                self.regress[key] = 0
            if first or (regressed and self.regress[key] >= self.REGRESS_FRAMES):
                # ilk görüş / KALICI gerileme (gerçek yeni seans) → geçmişi sıfırla.
                # Tek karelik gerileme yırtık okuma olabilir → aşağıda satır atlanır,
                # hist/prev korunur (AVG5/AVG yanıp sönmez).
                self.hist[key] = deque(maxlen=30)
                self.lap_log[key] = deque(maxlen=LAP_LOG_MAX)
                self.stint_start[key] = now
                self.prev_pits[key] = in_pits
                self.prev_laps[key] = laps
                self.regress[key] = 0
            elif regressed:
                pass                                             # şüpheli kare — dokunma
            elif laps > self.prev_laps[key]:                     # tur tamamlandı
                if self._valid_lap(last, best):
                    self.hist[key].append(round(last, 3))       # avg (filtreli)
                if last and last > 0:                            # tam liste (her tur)
                    self.lap_log[key].append((laps, round(last, 3)))
                self.prev_laps[key] = laps

            # stint: pit çıkışı (True→False) → süreyi sıfırla
            if self.prev_pits.get(key) and not in_pits:
                self.stint_start[key] = now
            self.prev_pits[key] = in_pits

            h = list(self.hist.get(key, ()))
            last5 = h[-5:]
            r["avg5Sec"] = round(sum(last5) / len(last5), 3) if last5 else None
            r["avgSec"] = round(sum(h) / len(h), 3) if h else None
            r["stintSec"] = int(now - self.stint_start.get(key, now))

            log = list(self.lap_log.get(key, ()))
            r["laps"] = [sec for _, sec in log]
            r["lapsFrom"] = log[0][0] if log else None
            # GERÇEK tur numaraları — log boşluklu olabilir (geçersiz tur atlanır ya da
            # lapsDone >1 atlar). JS bunu kullanır; ardışık varsayım tur kaymasına yol
            # açıyordu. laps/lapsFrom eski köprü sözleşmesi için korunur.
            r["lapNums"] = [n for n, _ in log]
            r["lapKey"] = _fbkey(key)   # Firebase-güvenli anahtar (livelaps yolu)

        own = data.get("own")
        if own is not None:
            me = next((r for r in field if r.get("isPlayer")), None)
            if me is not None:
                for k in ("avg5Sec", "avgSec", "stintSec", "laps", "lapsFrom",
                          "lapNums", "lapKey"):
                    own[k] = me.get(k)
        return data
