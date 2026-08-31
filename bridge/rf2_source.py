"""Veri kaynakları → web şeması ({session, own, field}).

İki kaynak:
  * MockSource  — oyun olmadan sahte ama tutarlı bir yarış üretir. Firebase→web
                  boru hattını test etmek için (köprüyü `--mock` ile çalıştır).
  * RF2Source   — rFactor2/LMU paylaşımlı belleğinden okur (pyRfactor2SharedMemory).
                  Alan adları rF2data.h'e dayanır; ilk çalıştırmada kendi
                  makinende doğrula (LMU sürümü offset kaydırabilir → tek nokta).

Şema (web LiveTab ile birebir):
  session: {phase, flag, timeLeftSec, totalLaps, trackTemp, ambientTemp, raining,
            rain, wetness, trackName, trackLength, sessionType, sessionId}
  own:     {fuel, fuelCapacity, virtualEnergy, position, lastLapSec, bestLapSec,
            curLapSec, s1, s2, lapsDone, inPits, pitStops, location, damage, avg5Sec,
            avgSec, stintSec, tyreCompound:{front,rear},
            tyres:{fl,fr,rl,rr:{wear,tempC,pressKpa}}}
  (virtualEnergy = LMU REST API'den; paylaşımlı bellekte yok. REST kapalıysa gelmez.)
  field[]: {pos, carId, driver, vehicleName, team, manufacturer, number, carClass, lapsDone,
            lapDist, posX, posZ, lastSec, lastSectors:[s1,s2,s3], bestSec, gapSec,
            intervalSec, lapsBehind, lapsBehindNext, inPits, location, pitStops, penalties,
            penaltiesTotal, tyreWear, tyres4:[fl,fr,rl,rr], tyreComp, damage, virtualEnergy,
            vePerLap, avg5Sec, avgSec, stintSec, laps, lapsFrom, lapNums, lapKey, isPlayer}
  (penalties = ANLIK bekleyen ceza (mNumPenalties; servis edilince 0'a düşer),
   penaltiesTotal = seans boyunca KÜMÜLATİF ceza (Aggregator yükselen kenar sayımı).
   NOT: gerçek "incident" (temas + track-cut) sayısı bu transport'ta YOKTUR — LMU'nun
   results-stream metni yalnız NATIVE LMU_Data arayüzünde bulunur; rF2 eklenti yolunda
   TinyPedal da incidents()=0 döndürür. Bu yüzden ceza ile incident karıştırılmamalı.)
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
aracın geçmişi bölünmesin diye). Bu turlar kalıcı append-only düğüme (livelaps/{rid}/
{lapKey}/{n}=sec) tur başına bir kez yazılır — sidecar yolunda köprü JS (liveBridge),
hafif köprüde harvest.py (v1.8.6) yazar; canlı kareden laps/lapsFrom çıkarılır ki kare
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


def _sector_yellows(sectors):
    """mSectorFlag[3] → lokal sarı sektör numaraları ([1..3]).

    v2.2.4 — TinyPedal ile HİZALANDI. `mSectorFlag` "o sektörde şu an lokal sarı var mı"
    dizisidir ve TinyPedal (LMU'da sahada kanıtlı) sarıyı KESİN EŞİTLİKLE okur:
        any(data == 1 for data in sec_flag)      # tinypedal/adapter/lmu_reader.py
    Bizim v1.4.74 öncesi kodumuz `> 0` kullanıyordu — Invalid/başlatılmamış bayt (255)
    de "sarı" sayıldığı için GREEN'de üç sektör birden sarı görünüyor ve yanlış
    'full yellow' üretiyordu. O bug yüzünden sektör sarıları TAMAMEN kapatılmıştı;
    sonuç: lokal sarı ARTIK HİÇ görünmüyordu (asıl kullanıcı şikâyeti). Doğru çözüm
    diziyi atmak değil, TinyPedal'ın predikatını kullanmak: yalnız `== 1`.
    Not: rF2 başlığı sektör sırasının belirsiz olduğunu söyler ("not sure if sector 0
    is first or last") → numaralar konumsaldır (i+1); bayrağın KENDİSİ kesindir."""
    out = []
    for i, v in enumerate(list(sectors or [])[:3]):
        try:
            if int(v) == 1:
                out.append(i + 1)
        except (TypeError, ValueError):
            pass
    return out


def _flag_of(phase, yellow, sectors=None):
    """Paylaşımlı bellek → (flag, yellowSectors). Bayrakların YETKİLİ kaynağı budur.

    v2.2.4: LMU REST'te bayrak verisi YOK (TinyPedal'ın kullandığı LMU endpoint listesi
    yalnız hava/seans/garaj/pit verir) → bayrak yalnız paylaşımlı bellekten gelebilir.
    Bu yüzden lokal sarı burada üretilir; REST artık yalnız EK kaynaktır (_merge_flags).
      * GamePhase 6 = tam pist sarısı (FCY / güvenlik aracı).
      * mYellowFlagState yalnız TAM PİST sürecini anlatır (0=None … 7=RaceHalt);
        c_ubyte olduğundan Invalid(-1) 255 gelir ⇒ makullük şartı 0 < v < 200.
      * mSectorFlag = LOKAL sarı (bkz. _sector_yellows)."""
    ysec = _sector_yellows(sectors)
    if phase == 6 or 0 < int(yellow) < 200:
        return "FCY", ysec
    if ysec:
        return "Yellow", ysec
    return "Green", []


#: bayrak şiddet sırası — birleştirmede en güçlüsü kazanır
_FLAG_RANK = {"Green": 0, "Yellow": 1, "FCY": 2}


def _merge_flags(shm_flag, shm_ysec, rest):
    """shmem + REST bayraklarını birleştir: EN GÜÇLÜ bayrak kazanır, sektörler BİRLEŞİR.

    Neden birleştirme: eskiden REST varsa shmem TAMAMEN yok sayılıyordu (`if rest_flag:`).
    REST bayrağı kendi içinde muhafazakâr (ör. üç sektör birden sarıysa Green'e düşürür,
    alan adları tutmazsa yetkili görünen sahte bir "Green" üretir) → gerçek sarıyı
    MASKELİYORDU. Artık hiçbir kaynak diğerinin sarısını bastıramaz: sarı yalnız EKLENİR."""
    flag, ysec = shm_flag, list(shm_ysec)
    if isinstance(rest, dict):
        rf = rest.get("flag") or "Green"
        if _FLAG_RANK.get(rf, 0) > _FLAG_RANK.get(flag, 0):
            flag = rf
        for s in rest.get("yellowSectors") or []:
            if s not in ysec:
                ysec.append(s)
    ysec.sort()
    if flag == "Green" and ysec:      # sektör sarısı geldiyse Green kalamaz
        flag = "Yellow"
    return flag, ysec

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


def _wait_reason(plugin_ok, track_loaded, num):
    """field boşken NEDEN boş? Tek "Oyun/seans bekleniyor" mesajı üç ayrı durumu
    gizliyordu — en sinsisi: Windows'ta mmap eksik adlandırılmış mapping'i SIFIRLARLA
    kendisi OLUŞTURUR (exception yok) → eklenti DLL'i kurulu/etkin değilken köprü
    "çalışıyor" görünür ve sonsuza dek bekler. Ayrım:
      noplugin   → eklenti sürüm string'i (Rf2Ext.mVersion) boş = DLL hiç yazmıyor
      menu       → eklenti var ama seans başlamamış (mSessionStarted=0, ana menü)
      novehicles → seansta ama araç listesi boş (nadir/geçici)
      None       → araç var (bekleme yok) ya da track_loaded bilinmiyor (eski struct)."""
    if num > 0:
        return None
    if not plugin_ok:
        return "noplugin"
    if track_loaded is False:
        return "menu"
    if track_loaded:
        return "novehicles"
    return None


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

    @staticmethod
    def _mock_tyres(el, i):
        """Sahte lastik durumu — pit döngüsüyle tutarlı, böylece Aggregator'ın
        değişim tespiti mock'ta da uçtan uca çalışır.
        TEK numaralı araçlar pit'te yalnız ÖN lastik değiştirir (arka sıfırlanmaz)
        → arayüzde '2 lastik' rozeti görünür. 3 numaralı araç bir süre sonra
        bileşim değiştirir (Medium → Wet)."""
        since_pit = ((int(el / 90) - i) % 11) * 90 + (el % 90)   # son pitten bu yana sn
        fr = round(max(0.2, 1 - since_pit / 1400), 3)
        rr = fr if i % 2 == 0 else round(max(0.2, 1 - (el % 2600) / 2600), 3)
        t4 = [fr, round(max(0.2, fr - 0.01), 3), rr, round(max(0.2, rr - 0.02), 3)]
        return {
            "tyres4": t4,
            "tyreWear": min(t4),
            "tyreComp": "Wet" if (i == 3 and el > 600) else "Medium",
            "teleLag": 0.0,
        }

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
                # ANLIK sektörler: bu turda geçilen S1/S2 (S1 ~%40, S2 ~%73 sonrası)
                "curSectors": ([None, None] if frac < 0.40 else
                               [round(lap_t * 0.25, 3), None] if frac < 0.73 else
                               [round(lap_t * 0.25, 3), round(lap_t * 0.44, 3)]),
                "bestSec": round(self.base[i], 3),
                "_prog": laps * 1e6 + (el % lap_t),  # sıralama için ilerleme
                "inPits": (int(el / 90) % 11) == i, "isPlayer": i == 4,
                "pitStops": laps // 45,  # ~45 turda bir durak
                "penalties": 1 if (i in (2, 6) and (int(el / 120) % 3) == 0) else 0,  # ara sıra ceza
                **self._mock_tyres(el, i),
                "damage": round(min(0.4, i * 0.01 + (el % 600) / 6000), 3),
                "lapDist": round(frac * self.TRACK_LEN, 1), "posX": px, "posZ": pz,
                # sektör (0=S3, 1=S1, 2=S2): eşit olmayan sınırlar → ayırıcılar görünür
                "sector": 1 if frac < 0.40 else 2 if frac < 0.73 else 0,
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
                "sessionId": "mock",   # sabit → demo canlı-geçmişi tekrar tekrar silmez
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
                # sürüş panosu (animasyonlu): gaz/fren dönüşümlü, vites hıza bağlı
                "throttle": round(max(0.0, math.sin(el * 1.3) * 0.5 + 0.5), 3),
                "brake": round(max(0.0, -math.sin(el * 1.3) * 0.6), 3),
                "gear": 1 + int((el % 12) / 2),
                "speedKph": round(180 + math.sin(el / 6) * 90),
                "rpm": round(6000 + math.sin(el * 1.3) * 2500), "rpmMax": 9000,
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

    def __init__(self, no_rest=False, rest_interval=3.0):
        # Bağımlılık yalnız burada; --mock modunda hiç import edilmez.
        from pyRfactor2SharedMemory.sharedMemoryAPI import SimInfoAPI  # noqa
        self.api = SimInfoAPI()
        # Virtual Energy paylaşımlı bellekte yok → LMU yerel REST API'den (opsiyonel).
        # no_rest: takılma teşhisi için REST'i tamamen kapat. REST, oyunun kendi yerel
        # sunucusuna (localhost:6397) istek atıyor; bu, oyunda mikro-takılmanın en güçlü
        # şüphelisi. lmu=None → tüm session_flags/standings/lookup çağrıları atlanır
        # (guard'lar zaten None'ı ele alıyor); bayrak shmem yedeğine düşer, VE/gerçek
        # takım/numara/marka gelmez.
        #
        # DONMA ÖNLEMİ (v1.4.131): REST artık read() İÇİNDE değil — LmuApi bir ARKA PLAN
        # POLLER thread'i (start()) çalıştırır; read()'in çağırdığı session_flags/
        # standings/lookup YALNIZ önbelleği okur (asla bloklamaz). rest_interval poller'ın
        # istek aralığıdır (varsayılan 3 sn; hâlâ takılırsa 5-10 yapılabilir).
        if no_rest:
            self.lmu = None
        else:
            try:
                from lmu_api import LmuApi
                self.lmu = LmuApi(interval=rest_interval)
                self.lmu.start()
            except Exception:
                self.lmu = None
        # Eklenti buffer ayarı (performans teşhisi) — DOSYA okuması pahalıdır, bu yüzden
        # başlangıçta bir kez + PLUGIN_CFG_EVERY sn'de bir; asla kare başına değil.
        self.plugin = None
        self.plugin_at = 0.0

    #: eklenti ayarını yeniden okuma aralığı (sn) — kullanıcı oyun kapalıyken düzeltir,
    #: uyarının kaybolması için dakikada bir tazelemek yeterli.
    PLUGIN_CFG_EVERY = 60.0

    def _plugin_diag(self):
        """{ enabled, mask, wasted, wastedFps, suggest } ya da None. Oyunun eklentisi
        bizim OKUMADIĞIMIZ buffer'ları (FFB/Graphics 400 FPS!) hâlâ yazıyorsa arayüz
        bunu söyleyip doğru `UnsubscribedBuffersMask` değerini önerir. Ayar dosyasına
        YAZILMAZ — yalnız okunur (başka araçların ihtiyacını biz bilemeyiz)."""
        now = time.time()
        # Kontrol YALNIZ zamana bakar: sonuç None olsa da (ayar okunamadı) 60 sn beklenir.
        # Aksi halde başarısız okuma HER KAREDE psutil.process_iter çalıştırırdı —
        # düzeltmeye çalıştığımız sorunun aynısı.
        if self.plugin_at and now - self.plugin_at < self.PLUGIN_CFG_EVERY:
            return self.plugin
        self.plugin_at = now
        try:
            from plugin_cfg import find_lmu_root, read_plugin_cfg, buffer_advice
            exe = None
            try:    # çalışan oyunun exe yolu → kurulum kökü (en güvenilir yol)
                import psutil
                for p in psutil.process_iter(["name", "exe"]):
                    nm = (p.info.get("name") or "").lower()
                    if "le mans ultimate" in nm or nm.startswith("rfactor2"):
                        exe = p.info.get("exe")
                        break
            except Exception:
                exe = None
            cfg = read_plugin_cfg(find_lmu_root(exe))
            if not cfg:
                self.plugin = None
                return None
            adv = buffer_advice(cfg.get("mask"))
            self.plugin = {"enabled": cfg.get("enabled"), "mask": adv["mask"],
                           "wasted": adv["wasted"], "wastedFps": adv["wastedFps"],
                           "suggest": adv["suggest"]}
        except Exception:
            self.plugin = None
        return self.plugin

    def close(self):
        if getattr(self, "lmu", None) is not None:
            try:
                self.lmu.close()      # arka plan poller thread'ini durdur
            except Exception:
                pass
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
    def _wear4(tele, laps=0):
        """4 tekerin diş oranı [fl, fr, rl, rr] (0..1; 1.0 = yeni). Pit'te KAÇ lastik
        değiştiğini anlamak için köşeler ayrı ayrı gerekir — tek bir 'en kötü' değeri
        iki-lastik değişimini göremez.

        ONLINE DÜZELTMESİ (v1.4.75): çok oyunculu yarışta oyunun paylaşımlı belleği
        RAKİP araçların lastik aşınmasını simüle/yayın ETMEZ → dört teker de tam 1.0
        (yeni) DONAR ve saha tablosunda herkes sahte '%100' görünür (single-player'da
        AI telemetrisi yerel olduğu için doğru çalışır). En az bir tur atmış bir araçta
        dört tekerin de tam 1.0 olması gerçek olamaz (gerçek lastik daha ilk turda
        1.0'ın altına iner) → veriyi 'yok' say (None → UI '—'/yalnız bileşim gösterir).
        Yarış başında (laps < 1) yeni lastik gerçekten 1.0 olabilir → dokunma."""
        try:
            w = [round(float(getattr(tele.mWheels[i], "mWear", 1.0)), 3)
                 for i in range(4)]
        except Exception:
            return None
        if laps >= 1 and all(x >= 1.0 for x in w):
            return None      # simüle edilmemiş (donmuş) rakip aşınması — sahte %100
        return w

    @classmethod
    def _worst_wear(cls, tele, laps=0):
        """4 tekerin en kötü (en düşük) diş oranı 0..1 — saha lastik göstergesi."""
        w = cls._wear4(tele, laps)
        return round(min(w), 3) if w else None

    @staticmethod
    def _compound(tele):
        """Bileşim: ön/arka aynıysa tek metin ('Wet'), farklıysa 'Ön/Arka'. Rakibin
        slick→wet geçişi aşınma sıçramasından bağımsız ikinci bir değişim sinyalidir."""
        try:
            f = _s(getattr(tele, "mFrontTireCompoundName", b""))
            r = _s(getattr(tele, "mRearTireCompoundName", b""))
        except Exception:
            return None
        if not f and not r:
            return None
        if f and r and f != r:
            return f"{f}/{r}"
        return f or r

    @staticmethod
    def _speed(tele):
        """Hız (km/h) — mLocalVel (yerel hız vektörü, m/s) büyüklüğü × 3.6. Yoksa None."""
        try:
            v = getattr(tele, "mLocalVel", None)
            if v is None:
                return None
            return math.hypot(float(v.x), float(v.y), float(v.z)) * 3.6
        except Exception:
            return None

    @staticmethod
    def _tele_lag(tele, player_et):
        """Bu aracın telemetri karesi oyuncununkinden kaç sn geride? Online yarışta
        rakip telemetrisi güncellenmeyebilir; donmuş bir aşınma değerini gerçekmiş
        gibi göstermemek için UI bunu kullanır. (TinyPedal'daki `desynced` kontrolünün
        aynısı — orada eşik 0.01 sn, burada ham değeri taşıyıp kararı UI'a bırakıyoruz.)"""
        try:
            et = float(getattr(tele, "mElapsedTime", 0.0))
            if not (player_et > 0 and et > 0):
                return None
            return round(player_et - et, 2)
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
    def _cur_sectors(v):
        """ANLIK sektörler: MEVCUT turda araç sektör çizgisini geçtiği AN oluşan süre.
        rF2: mCurSector1 = bu turun S1'i (S1 çizgisini geçince geçerli),
        mCurSector2 = bu turun S1+S2 kümülatifi (S2 çizgisini geçince geçerli).
        Dönüş [s1, s2]: henüz geçilmeyen sektör None. (S3 ancak S/F geçilince =
        tamamlanır → _sectors/lastSectors.)"""
        try:
            s1 = float(getattr(v, "mCurSector1", -1.0))
            s12 = float(getattr(v, "mCurSector2", -1.0))
            o1 = round(s1, 3) if s1 > 0 else None
            o2 = round(s12 - s1, 3) if (s1 > 0 and s12 > s1) else None
            return [o1, o2]
        except Exception:
            return [None, None]

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

        # Eklenti GERÇEKTEN yazıyor mu? mVersion boş = mapping'i mmap kendisi
        # oluşturdu (DLL kurulu/etkin değil — bkz. _wait_reason). mSessionStarted
        # menü/seans ayrımını verir. İkisi de Rf2Ext'te; yoksa "bilinmiyor".
        shm_ver = _s(getattr(ext, "mVersion", b"")) if ext is not None else ""
        try:
            track_loaded = bool(int(ext.mSessionStarted)) if ext is not None else None
        except Exception:
            track_loaded = None

        # KARARLI seans belirteci — seans değişince (antrenman→yarış) değişir; aynı
        # seansta SABİT kalır. Web tarafı bu değişince o yarışın canlı-geçmişini bir kez
        # temizler (eski seansın turları yeni seansa sızmasın).
        # DİKKAT (v1.4.139): yalnız mSession (seans indeksi) kullanılır — bu değer TÜM
        # bağlı PC'lerde AYNIdır. Eskiden mTicksSessionStarted de eklenmişti ama o PC-YEREL
        # bir tick sayacı; çok-PC yayında (v1.4.137) her PC farklı belirteç üretip yazıcı
        # kirası el değiştirdikçe canlı-geçmişi SİLİYORDU ("9 tur atıldı ama 0 görünüyor").
        # mSession antrenman(1-4)/sıralama(5-8)/yarış(10-13) geçişlerini yine ayırır.
        m_sess = int(getattr(info, "mSession", -1))
        session_id = str(m_sess)

        # seans
        cur, end = float(info.mCurrentET), float(info.mEndET)
        phase = int(getattr(info, "mGamePhase", 0))
        yellow = int(getattr(info, "mYellowFlagState", 0))
        # Bayrak (v2.2.4): YETKİLİ kaynak paylaşımlı bellektir — lokal sarı dahil
        # (bkz. _flag_of/_sector_yellows). REST varsa yalnız EK kaynaktır ve hiçbir
        # sarıyı bastıramaz (_merge_flags). Eskiden REST açıkken shmem tamamen yok
        # sayılıyor, REST kapalıyken (VARSAYILAN!) ise yedek yalnız FCY ürettiği için
        # lokal sarı HİÇBİR koşulda görünmüyordu — sahadaki "sarı bayrak yok" hatası.
        rest_flag = None
        if getattr(self, "lmu", None) is not None:
            try:
                rest_flag = self.lmu.session_flags()
            except Exception:
                rest_flag = None
        shm_flag, shm_ysec = _flag_of(phase, yellow, getattr(info, "mSectorFlag", None))
        flag, ysec = _merge_flags(shm_flag, shm_ysec, rest_flag)
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
            "sessionId": session_id,   # kararlı seans belirteci (web canlı-geçmiş temizler)
        }

        # telemetriyi mID ile eşle (saha başına lastik aşınması + hasar için)
        tele_by_id = {}
        player_et = 0.0        # oyuncunun telemetri saati — rakip karesi ne kadar geride?
        for i in range(min(num, len(tele.mVehicles))):
            tv = tele.mVehicles[i]
            tele_by_id[int(getattr(tv, "mID", -1))] = tv
            if bool(getattr(tv, "mIsPlayer", 0)):
                player_et = float(getattr(tv, "mElapsedTime", 0.0) or 0.0)

        # saha (scoring + eşleşen telemetri)
        field, player_scor = [], None
        for i in range(min(num, len(scor.mVehicles))):
            v = scor.mVehicles[i]
            is_player = bool(getattr(v, "mIsPlayer", 0))
            if is_player:
                player_scor = v
            tv = tele_by_id.get(int(getattr(v, "mID", -2)))
            laps = int(getattr(v, "mTotalLaps", 0))
            px, pz = self._pos(v)
            field.append({
                "pos": int(getattr(v, "mPlace", 0)),
                # ARAÇ kimliği (slot ID) — sürücü adı endurance'ta pilot değişiminde
                # değişir; tur geçmişi/ortalama/lapKey buna değil buna bağlanmalı.
                "carId": int(getattr(v, "mID", -1)),
                "driver": _s(getattr(v, "mDriverName", b"")),
                "vehicleName": _s(getattr(v, "mVehicleName", b"")),
                "carClass": _s(getattr(v, "mVehicleClass", b"")),
                "lapsDone": laps,
                "lapDist": round(float(getattr(v, "mLapDist", 0.0)), 1),
                "posX": px, "posZ": pz,
                # mevcut sektör (0=S3, 1=S1, 2=S2) — harita sektör ayırıcıları bunun
                # lapDist ile değiştiği andan sınırı gözlemler (web tarafı)
                "sector": int(getattr(v, "mSector", -1)),
                "lastSec": round(float(getattr(v, "mLastLapTime", -1.0)), 3),
                "lastSectors": self._sectors(v),   # [S1,S2,S3] (popup tur listesi)
                "curSectors": self._cur_sectors(v),   # [s1,s2] bu turda ANLIK geçilen sektörler
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
                # bekleyen ceza sayısı (drive-through/stop-go vb.) — standings'te ⚠N
                "penalties": int(getattr(v, "mNumPenalties", 0) or 0),
                "tyreWear": self._worst_wear(tv, laps) if tv is not None else None,
                # köşe köşe aşınma + bileşim: pit'te kaç/hangi lastiğin değiştiği
                # ancak bunlardan çıkar (Aggregator pit giriş/çıkışını karşılaştırır)
                "tyres4": self._wear4(tv, laps) if tv is not None else None,
                "tyreComp": self._compound(tv) if tv is not None else None,
                "teleLag": self._tele_lag(tv, player_et) if tv is not None else None,
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
                # canlı sürüş telemetrisi (pit duvarı "sürüş panosu")
                "throttle": round(float(getattr(pt, "mUnfilteredThrottle", 0.0) or 0.0), 3),
                "brake": round(float(getattr(pt, "mUnfilteredBrake", 0.0) or 0.0), 3),
                "gear": (lambda g: int(g) if g is not None else None)(
                    getattr(pt, "mGear", None)),
                "speedKph": (lambda s: round(s) if s is not None else None)(self._speed(pt)),
                "rpm": round(float(getattr(pt, "mEngineRPM", 0.0) or 0.0)),
                "rpmMax": round(float(getattr(pt, "mEngineMaxRPM", 0.0) or 0.0)),
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
                if st.get("penalties") is not None:
                    # cut/puan cezaları yalnız REST'te görünür (mNumPenalties saymıyor);
                    # iki kaynağın BÜYÜĞÜ gösterilir (drive-through shmem'de de var)
                    rec["penalties"] = max(int(rec.get("penalties") or 0),
                                           int(st["penalties"]))
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
            # Eskiden sabit True'ydu — eklenti yokken de ✓ görünüyordu (hayalet
            # mapping). Artık gerçek kanıt: eklenti sürüm string'i dolu mu?
            "shm": bool(shm_ver),
            "shmVersion": shm_ver or None,
            "trackLoaded": track_loaded,
            "cars": len(field),
            "lmu": lmu_ok,
            "ve": sum(1 for r in field if r.get("virtualEnergy") is not None),
            # bayrak ham değerleri — sahada bayrak yine ters düşerse --dump ile
            # alan semantiği buradan doğrulanır (LMU sürümü alanları kaydırabilir).
            # rest: REST YETKİLİ sonucu (varsa kullanıldı), sectors: shmem ham (güvenilmez).
            # shm: paylaşımlı bellekten türetilen YETKİLİ bayrak, rest: EK kaynak,
            # sectors: ham mSectorFlag baytları (sarı = 1; 255 = Invalid/dolu değil).
            "flagRaw": {"phase": phase, "yellow": yellow, "rest": rest_flag,
                        "shm": [shm_flag, shm_ysec], "out": [flag, ysec],
                        "sectors": [int(x) for x in list(getattr(info, "mSectorFlag", []) or [])[:3]]},
        }
        # Saha boşken bekleme NEDENİ — UI mesaj seçimi (noplugin/menu/novehicles).
        if not field:
            diag["wait"] = _wait_reason(bool(shm_ver), track_loaded, num)
        # Eklenti buffer yükü (performans) — dakikada bir okunur, kare maliyeti yok.
        pl = self._plugin_diag()
        if pl:
            diag["plugin"] = pl
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
        self.pending = {}       # sürücü → süresi henüz gelmemiş tamamlanmış tur no (bkz. read)
        self.prev_pits = {}     # sürücü → son görülen inPits
        self.stint_start = {}   # sürücü → stint başlangıcı (time.time())
        self.regress = {}       # sürücü → ardışık gerileme sayacı (yırtık kare filtresi)
        self.pit_tyres = {}     # araç → pit GİRİŞİNDEKİ (tyres4, tyreComp) anlık görüntüsü
        self.last_change = {}   # araç → son pit'te değişen lastikler (bir sonraki pite kadar)
        self.prev_ve = {}       # araç → önceki tur sonundaki VE% (tur-başı tüketim için)
        self.ve_per_lap = {}    # araç → son turda tüketilen VE% (prev−cur)
        self.prev_pen = {}      # araç → son görülen BEKLEYEN ceza (mNumPenalties)
        self.pen_total = {}     # araç → KÜMÜLATİF ceza (yükselen kenar toplamı)

    def close(self):
        if hasattr(self.inner, "close"):
            self.inner.close()

    #: Bir köşenin "değişti" sayılması için diş oranının pit'te en az bu kadar
    #: YÜKSELMESİ gerekir. Yeni lastik 1.0'a döner; aşınmış set takılırsa sıçrama
    #: küçük olur → o durumda bileşim değişimi ikinci sinyaldir (bkz. tyre_change).
    TYRE_JUMP = 0.05
    CORNERS = ("fl", "fr", "rl", "rr")

    @staticmethod
    def _valid_lap(last, best):
        if not (last and last > 20):
            return False           # geçersiz/çok kısa
        if best and best > 0 and last > best * 1.10:
            return False           # out-lap / pit turu → ortalamayı bozma
        return True

    @classmethod
    def tyre_change(cls, before, after, comp_before=None, comp_after=None):
        """Pit ÖNCESİ ve SONRASI lastik durumundan değişimi çıkar — SAF (testli).

        `before`/`after`: [fl, fr, rl, rr] diş oranı (0..1) ya da None.
        Döner: {"n": kaç lastik, "corners": ["fl",...], "comp": yeni bileşim|None}
        ya da karar verilemiyorsa None (veri yok → uydurma yapma).

        Bileşim değiştiyse aşınma sıçraması küçük olsa bile TÜM lastikler değişmiştir
        (oyunda bileşimi tek köşede değiştirmek mümkün değil)."""
        comp_changed = bool(comp_before and comp_after and comp_before != comp_after)
        ok = (isinstance(before, (list, tuple)) and isinstance(after, (list, tuple))
              and len(before) >= 4 and len(after) >= 4)
        if not ok:
            # Aşınma okunamıyor (rakip telemetrisi yok) ama bileşim değiştiyse
            # yine de "4 lastik" diyebiliriz — bu kesin bir bilgi.
            if comp_changed:
                return {"n": 4, "corners": list(cls.CORNERS), "comp": comp_after}
            return None
        try:
            jumped = [i for i in range(4) if float(after[i]) - float(before[i]) >= cls.TYRE_JUMP]
        except (TypeError, ValueError):
            return None
        if comp_changed:
            return {"n": 4, "corners": list(cls.CORNERS), "comp": comp_after}
        return {"n": len(jumped), "corners": [cls.CORNERS[i] for i in jumped], "comp": None}

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
                self.pending.pop(key, None)
                self.regress[key] = 0
                self.pit_tyres.pop(key, None)
                self.last_change.pop(key, None)
                # ceza sayaçları da seansa özeldir (yeni seans → sıfırdan başla)
                self.pen_total.pop(key, None)
                self.prev_pen.pop(key, None)
                # VE tur-başı tüketimi için başlangıç değerini (varsa) taban al
                self.ve_per_lap.pop(key, None)
                _cve = r.get("virtualEnergy")
                self.prev_ve[key] = (_cve if isinstance(_cve, (int, float))
                                     and not isinstance(_cve, bool) else None)
            elif regressed:
                pass                                             # şüpheli kare — dokunma
            elif laps > self.prev_laps[key]:                     # tur tamamlandı
                if self._valid_lap(last, best):
                    self.hist[key].append(round(last, 3))       # avg (filtreli)
                if last and last > 0:                            # tam liste (her tur)
                    self.lap_log[key].append((laps, round(last, 3)))
                    self.pending.pop(key, None)
                else:
                    # Oyun S/F'de tur SAYACINI, son-tur SÜRESİNDEN (mLastLapTime) birkaç
                    # kare önce günceller (ya da yırtık kare süreyi 0 okur). prev_laps yine
                    # ilerlediğinden bu tur BİR DAHA "elif" dalına girmez → süre gelince
                    # kaybolmasın diye numarayı beklemeye al, aşağıda süre gelince yaz.
                    self.pending[key] = laps
                # tur-başı VE tüketimi: tur sınırında prev−cur (yalnız LMU REST açıkken
                # virtualEnergy dolu; dolum/anomali >50% ele). REST yoksa vePerLap None kalır.
                cur_ve = r.get("virtualEnergy")
                if isinstance(cur_ve, (int, float)) and not isinstance(cur_ve, bool):
                    pv = self.prev_ve.get(key)
                    if isinstance(pv, (int, float)) and 0 < pv - cur_ve < 50:
                        self.ve_per_lap[key] = round(pv - cur_ve, 1)
                    self.prev_ve[key] = cur_ve
                self.prev_laps[key] = laps

            # BEKLEYEN TUR: yukarıda süresi 0 gelen tur, süre geldiğinde yazılır. Arada
            # YENİ tur tamamlandıysa (pending != güncel laps) süre artık o yeni tura ait →
            # bayat pending atılır. Aynı tur numarasını iki kez yazmayı da engelle.
            pend = self.pending.get(key)
            if pend is not None:
                if pend != laps:
                    self.pending.pop(key, None)
                elif last and last > 0:
                    lg = self.lap_log.setdefault(key, deque(maxlen=LAP_LOG_MAX))
                    if not lg or lg[-1][0] != pend:
                        lg.append((pend, round(last, 3)))
                        if self._valid_lap(last, best):
                            self.hist.setdefault(key, deque(maxlen=30)).append(round(last, 3))
                    self.pending.pop(key, None)

            # stint + lastik değişimi: pit giriş/çıkış kenarları
            was_pits = self.prev_pits.get(key)
            if not was_pits and in_pits:
                # PİT GİRİŞİ — o anki (eski) lastikleri sakla, çıkışta karşılaştıracağız
                self.pit_tyres[key] = (r.get("tyres4"), r.get("tyreComp"))
            elif was_pits and not in_pits:
                # PİT ÇIKIŞI — hangi köşeler yenilendi?
                self.stint_start[key] = now
                before, comp_before = self.pit_tyres.pop(key, (None, None))
                ch = self.tyre_change(before, r.get("tyres4"), comp_before, r.get("tyreComp"))
                if ch is not None:
                    ch["lap"] = laps
                    self.last_change[key] = ch
            self.prev_pits[key] = in_pits
            # Son pit'te ne değiştiği bir sonraki pite kadar görünür kalır (pit duvarı
            # rakibin stint boyunca hangi lastiklerle gittiğini görmeli).
            r["tyreChange"] = self.last_change.get(key)

            # CEZA (v2.2.4): `mNumPenalties` başlıkta "number of OUTSTANDING penalties"
            # — yani BEKLEYEN ceza; sürücü drive-through'unu çekince 0'a GERİ DÜŞER.
            # Kümülatif toplam sanılırsa yarış boyunca yanlış okunur (ceza servis edilir
            # edilmez ekran temizlenir). Doğru toplam YÜKSELEN KENARLARDAN biriktirilir —
            # TinyPedal'ın module_stats.py'deki deseninin birebir aynısı:
            #   düşüş → tabanı indir (servis edildi), yükseliş → farkı toplama ekle.
            # İlk görüşte yalnız taban alınır (yarışa geç katılınca eski cezalar
            # şişirilmesin). penalties = anlık bekleyen, penaltiesTotal = kümülatif.
            cur_pen = r.get("penalties")
            cur_pen = int(cur_pen) if isinstance(cur_pen, (int, float)) else 0
            prev_pen = self.prev_pen.get(key)
            if prev_pen is None:
                self.prev_pen[key] = cur_pen          # ilk kare → yalnız taban
            elif cur_pen < prev_pen:
                self.prev_pen[key] = cur_pen          # ceza çekildi → tabanı düşür
            elif cur_pen > prev_pen:
                self.pen_total[key] = self.pen_total.get(key, 0) + (cur_pen - prev_pen)
                self.prev_pen[key] = cur_pen
            r["penaltiesTotal"] = self.pen_total.get(key, 0)

            h = list(self.hist.get(key, ()))
            last5 = h[-5:]
            r["avg5Sec"] = round(sum(last5) / len(last5), 3) if last5 else None
            r["avgSec"] = round(sum(h) / len(h), 3) if h else None
            r["stintSec"] = int(now - self.stint_start.get(key, now))
            r["vePerLap"] = self.ve_per_lap.get(key)   # tur-başı VE tüketimi (yoksa None)

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
                for k in ("avg5Sec", "avgSec", "stintSec", "vePerLap", "penaltiesTotal",
                          "laps", "lapsFrom", "lapNums", "lapKey"):
                    own[k] = me.get(k)
        return data
