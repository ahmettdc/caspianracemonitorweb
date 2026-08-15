"""harvest — hafif köprüde tur geçmişini KALICI düğümlere taşı (v1.8.6).

NEDEN: "+" tur listesi popup'ı livelaps/{rid}/{lapKey}/{n} düğümünden okur; bu
düğümü bugüne dek YALNIZ masaüstü uygulamasının JS tarafı (src/liveBridge.js
harvestLaps) yazıyordu. Sürüş PC'si donma düzeltmeleriyle birlikte hafif köprüye
(CaspianLiveBridge) geçince kareler akmaya devam etti ama tur geçmişi HİÇ
yazılmadı → popup her araçta "Henüz tamamlanmış tur yok" gösterdi. Bu modül
JS harvest'inin birebir Python portudur; run_loop (nogui) ve GUI köprüsü her
karede process() çağırır, dönen patch'ler teams/{tid} altına PATCH edilir
(fb.patch_team) ve kare küçültülür (laps/lapsFrom/lapNums/tyreChange satırdan
silinir — JS'in yazdığı kare şekliyle aynı).

Sidecar yolu (main.py --emit) DEĞİŞMEZ: orada harvest'i JS yapar.
Saf mantık — ağ yok; test: bridge/test_harvest.py.
"""

#: Temizlik yapılan kalıcı düğümler (JS storage.liveHistoryClearAll ile birebir).
LAP_NODES = ("livelaps", "livepos", "livesec", "livedrv", "livetyre", "livecond")


def _num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


# --- Tutuş (rubber) tahmini — src/engine.js rubberPct birebir portu (TinyPedal
#     formülleri; modellenmiş tahmin). livecond "temp,wet,grip" dizesi için. ---
def _laps_to_rubber(v, m=2000.0):
    return 1.0 if v > m * 2 else (0.75 + (v - m) / m / 4 if v > m
                                  else (v * 0.75 / m if v > 0 else 0.0))


def _rubber_to_laps(v, m=2000.0):
    return m * 2 if v >= 1 else (m + (v - 0.75) * m * 4 if v > 0.75
                                 else (v * m / 0.75 if v > 0 else 0.0))


def rubber_pct(session_type, total_laps):
    start = 0.25 if session_type in ("Test", "Antrenman") else 0.5
    laps = _rubber_to_laps(start) + max(0, _num(total_laps) or 0)
    return round(_laps_to_rubber(laps) * 100)


def _lap_numbers_of(row):
    """laps[] ile hizalı GERÇEK tur numaraları (src/liveLaps.lapNumbersOf portu)."""
    laps = row.get("laps")
    if not isinstance(laps, list) or not laps:
        return []
    nums = row.get("lapNums")
    if (isinstance(nums, list) and len(nums) == len(laps)
            and all(_num(n) is not None and n > 0 for n in nums)):
        return nums
    frm = _num(row.get("lapsFrom"))
    if not (frm and frm > 0):
        return []
    return [frm + i for i in range(len(laps))]


class Harvester:
    """Kare kare tur geçmişi biriktirici — JS liveBridge.harvestLaps durum makinesi.

    process(payload) → teams/{tid} altına SIRAYLA uygulanacak patch dict listesi
    (temizlikler ayrı patch'te önce gelir; RTDB çok-yollu update'te ata+torun yolu
    aynı gövdede olamaz). payload YERİNDE kırpılır.
    """

    #: Yarış-restart dedektörü: saha max lapsDone ≥2'den 0'a bu kadar ARDIŞIK
    #: karede düşerse restart sayılır (tekil bozuk kareye karşı — JS v1.6.3).
    ZERO_FRAMES = 2

    def __init__(self, rid, known_session_id=None):
        self.rid = rid
        #: Spawn'dan önce Firebase'den okunan seans belirteci — None = bu yarışta
        #: kayıtlı geçmiş yok (fresh-start temizliği ateşlenmez).
        self.known_session_id = known_session_id
        self.fresh_checked = False
        self.prev_max_laps = 0
        self.zero_frames = 0
        self.last_lap = {}    # lapKey → yazılmış en yüksek tur no (append idempotent)
        self.last_pit = {}    # lapKey → son görülen pit durak sayısı
        self.last_drv = {}    # lapKey → son yazılan pilot adı (yalnız DEĞİŞİNCE yazılır)
        self.last_tyre = {}   # lapKey → son yazılan pit-lastik-değişimi turu

    def _clear_all(self):
        return {f"{n}/{self.rid}": None for n in LAP_NODES}

    def _clear_key(self, key):
        return {f"{n}/{self.rid}/{key}": None for n in LAP_NODES}

    def _reset(self):
        self.last_lap = {}
        self.last_pit = {}
        self.last_drv = {}
        self.last_tyre = {}

    def process(self, payload):
        patches = []
        had_history = self.known_session_id is not None
        sess = (payload or {}).get("session") or {}

        # YENİ SEANS (antrenman→yarış): belirteç değişti → tüm geçmişi bir kez temizle.
        sid = sess.get("sessionId")
        if sid and sid != self.known_session_id:
            if self.known_session_id is not None:
                patches.append(self._clear_all())
                self._reset()
            self.known_session_id = sid

        rows = (payload or {}).get("field") or []
        if rows:
            max_laps = max((int(r.get("lapsDone") or 0) for r in rows), default=0)
            if not self.fresh_checked:
                # AYNI yarışı tekrar koşma: köprü yeni başladı + yarış tam başta +
                # rid'de eski kayıt var → bir kez temizle (JS v1.6).
                self.fresh_checked = True
                if had_history and max_laps == 0:
                    patches.append(self._clear_all())
                    self._reset()
            elif max_laps == 0 and self.prev_max_laps >= 2:
                # Köprü çalışırken lobby restart (JS v1.6.3).
                self.zero_frames += 1
                if self.zero_frames >= self.ZERO_FRAMES:
                    patches.append(self._clear_all())
                    self._reset()
                    self.prev_max_laps = 0
                    self.zero_frames = 0
            else:
                self.zero_frames = 0
                if max_laps > 0:
                    self.prev_max_laps = max_laps

        # Pist koşulu dizesi — kare başına aynı (livecond "temp,wet,grip").
        total_laps = sum(int(r.get("lapsDone") or 0) for r in rows)
        grip = rubber_pct(sess.get("sessionType"), total_laps)
        t = _num(sess.get("trackTemp"))
        w = _num(sess.get("wetness"))
        t_s = str(round(t)) if t is not None else ""
        w_s = str(round(w)) if w is not None else ""
        cond = f"{t_s},{w_s},{grip}" if (t_s or w_s) else None

        upd = {}
        for r in rows:
            key = r.get("lapKey")
            laps = r.get("laps") if isinstance(r.get("laps"), list) else None
            nums = _lap_numbers_of(r)
            if key and laps and len(nums) == len(laps):
                first, max_n = nums[0], nums[-1]
                # Araç-başı gerileme (eski köprü / belirteçsiz güvenlik): gelen turlar
                # yazdığımızdan geride → o aracın geçmişini sıfırla.
                if (self.last_lap.get(key) is not None
                        and first <= self.last_lap[key] and max_n < self.last_lap[key]):
                    patches.append(self._clear_key(key))
                    self.last_lap[key] = 0
                    self.last_pit[key] = int(r.get("pitStops") or 0)
                    self.last_drv.pop(key, None)
                    self.last_tyre.pop(key, None)
                prev = self.last_lap.get(key) or 0

                # PİLOT: yalnız DEĞİŞTİĞİ turda yaz (okuma tarafı ileri doldurur).
                drv = r.get("driver").strip() if isinstance(r.get("driver"), str) else ""
                first_new = next((n for n, s in zip(nums, laps)
                                  if n > prev and _num(s) and s > 0), None)
                if drv and first_new is not None and self.last_drv.get(key) != drv:
                    upd[f"livedrv/{self.rid}/{key}/{int(first_new)}"] = drv
                    self.last_drv[key] = drv

                # PİT LASTİK DEĞİŞİMİ: tyreChange {n, lap} → "adet|hamur" bir kez.
                tch = r.get("tyreChange")
                if isinstance(tch, dict):
                    tl = _num(tch.get("lap"))
                    if tl and tl > 0 and self.last_tyre.get(key) != tl:
                        comp = r.get("tyreComp") if isinstance(r.get("tyreComp"), str) else ""
                        upd[f"livetyre/{self.rid}/{key}/{int(tl)}"] = f"{tch.get('n') or 0}|{comp}"
                        self.last_tyre[key] = tl

                pits = int(r.get("pitStops") or 0)
                pitted = pits > self.last_pit.get(key, pits)
                pos = _num(r.get("pos")) or 0
                for n, s in zip(nums, laps):
                    if n > prev and _num(s) and s > 0:
                        upd[f"livelaps/{self.rid}/{key}/{int(n)}"] = s
                    if n > prev and pos > 0:  # pozisyon geçmişi (pit turu → negatif)
                        upd[f"livepos/{self.rid}/{key}/{int(n)}"] = (
                            -pos if (n == max_n and pitted) else pos)
                # sektörler + pist koşulu: yalnız en yeni tur (max_n) için
                sc = r.get("lastSectors")
                if (max_n > prev and isinstance(sc, list) and len(sc) == 3
                        and all(_num(v) and v > 0 for v in sc)):
                    upd[f"livesec/{self.rid}/{key}/{int(max_n)}"] = f"{sc[0]},{sc[1]},{sc[2]}"
                if max_n > prev and cond:
                    upd[f"livecond/{self.rid}/{key}/{int(max_n)}"] = cond
                if max_n > (self.last_lap.get(key) or 0):
                    self.last_lap[key] = int(max_n)
                self.last_pit[key] = pits
            # Kare küçük kalsın — geçmiş kalıcı düğümde (JS ile aynı kare şekli).
            for f in ("laps", "lapsFrom", "lapNums", "tyreChange"):
                r.pop(f, None)

        own = (payload or {}).get("own")
        if isinstance(own, dict):
            for f in ("laps", "lapsFrom", "lapNums"):
                own.pop(f, None)

        if upd:
            patches.append(upd)
        return patches
