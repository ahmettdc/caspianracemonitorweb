/* ============================================================
   Tur geçmişi OKUYUCU-tarafı hasat — SAF mantık (React/Firebase'siz, test edilebilir)
   ------------------------------------------------------------
   NEDEN (v1.8.12): Tur geçmişi bugüne dek YALNIZ köprü (harvest.py / liveBridge.js)
   tarafından yazılıyordu → sürüş PC'sindeki köprü ESKİ ise (hafif köprüde sürüm yazısı
   yok, otomatik güncelleme yok, harvest kodu v1.8.6'da eklendi) hiçbir tur kaydolmuyor,
   üstelik bunu kimse göremiyordu (harvest'te log yok). Web (Pages) ise her push'ta anında
   herkese dağıtılır. O yüzden hasadı da web'e getiriyoruz: canlı kare (`live`) zaten satır
   başına lapKey/lapsDone/lastSec/lastSectors + kare düzeyinde session taşıyor → izleyen
   editör tarayıcısı `lapsDone` artışını gözleyip turu livelaps'e yazar. Köprü sürümünden
   BAĞIMSIZ; köprü harvest'i idempotent YEDEK olarak kalır (aynı {lapKey}/{n}=sec).

   Kısıt (her iki yöntem için aynı): paylaşımlı bellek geçmiş vermez. Reader'da `lastSec`
   tek skalerdir → araç `lapsDone` bir karede N-1→N geçtiğinde YALNIZ o turu (lastSec)
   yazabiliriz. lapsDone bir karede >1 atlarsa (tarayıcı ~90 sn+ arka planda kısılırsa)
   aradaki turların süresi kurtarılamaz → köprü yedeği (laps[] var) o boşluğu kapatır.
   İzlemeye BAŞLAMADAN önce tamamlanan turlar da kaydolmaz (ilk görüşte yazmayız).

   Desen: fuelObs.js — durum ref'te YERİNDE güncellenir, saf `lapObserve(state, frame)`
   yan-etki TARİFİ döndürür (yazımı/temizliği çağıran yapar).
   ============================================================ */
import { rubberPct } from "./engine.js";

const ZERO_FRAMES = 2;   // lobi-restart debounce (harvest.py ZERO_FRAMES portu)

/* Gözlemci durumunun sıfır hali.
   sid: bilinen sessionId · prevLaps: lapKey→son hesaba katılan lapsDone ·
   prevMax/zeroFrames: lobi-restart tespiti · captured: bu seansta yazılan tur sayısı. */
export const newLapObs = () => ({
  sid: null, prevLaps: Object.create(null),
  prevMax: 0, zeroFrames: 0, captured: 0,
});

const isNum = (x) => typeof x === "number" && Number.isFinite(x);

/* Bir canlı kareyi işle (durumu YERİNDE günceller). scope: hangi düğümler yazılsın
   (varsayılan livelaps+livesec+livecond; livepos/livedrv köprü yedeğinden gelir).
   Döner: { writes, clears, captured, cars } — writes[node] = { "lapKey/n": değer },
   clears = { all: bool, keys: [lapKey] }. Firebase YOK → çağıran uygular. */
export function lapObserve(state, frame, opts = {}) {
  const scope = opts.scope || { livelaps: true, livesec: true, livecond: true };
  const writes = { livelaps: {}, livesec: {}, livecond: {} };
  const clears = { all: false, keys: [] };
  const rows = Array.isArray(frame?.field) ? frame.field : null;
  if (!rows) return { writes, clears, captured: state.captured, cars: 0 };

  // 1) Seans değişimi → tüm rid geçmişini bir kez temizle (yapısal phantom-veri koruması).
  const sid = frame?.session?.sessionId;
  if (sid != null && sid !== "" && sid !== state.sid) {
    if (state.sid != null) { clears.all = true; state.prevLaps = Object.create(null); }
    state.sid = sid;
    state.prevMax = 0; state.zeroFrames = 0;
  }

  // 2) Lobi-restart: saha zirvesi 2+ iken ardışık ZERO_FRAMES kare max=0 → yeni koşu.
  const max = rows.reduce((m, r) => Math.max(m, isNum(r?.lapsDone) ? r.lapsDone : 0), 0);
  if (max === 0 && state.prevMax >= 2) {
    state.zeroFrames += 1;
    if (state.zeroFrames >= ZERO_FRAMES) {
      clears.all = true; state.prevLaps = Object.create(null);
      state.prevMax = 0; state.zeroFrames = 0;
    }
  } else {
    state.zeroFrames = 0;
    if (max > state.prevMax) state.prevMax = max;
  }

  // 3) Koşul dizesi (livecond) kare düzeyinde ortaktır → bir kez kur.
  const ses = frame?.session || {};
  let condStr = null;
  if (scope.livecond) {
    const temp = isNum(ses.trackTemp) ? ses.trackTemp : "";
    const wet = isNum(ses.wetness) ? ses.wetness : "";
    // grip: rubberPct TÜM araçların tur TOPLAMI'nı ister (TinyPedal module_vehicles —
    // harvest.py `total_laps=sum(...)` ve LiveTab canlı "Tutuş" KPI'sı ile AYNI). Eskiden
    // yanlışlıkla `max` (tek araç) veriliyordu → grip fazla düşük çıkıyordu (ör. %52 vs %75).
    const totalLaps = rows.reduce((a, r) => a + (isNum(r?.lapsDone) ? r.lapsDone : 0), 0);
    const grip = rubberPct(ses.sessionType, totalLaps);
    condStr = `${temp},${wet},${grip}`;
  }

  // 4) Satır başına: lapsDone artışında turu yaz.
  for (const r of rows) {
    const key = r?.lapKey;
    if (typeof key !== "string" || !key) continue;
    const laps = isNum(r?.lapsDone) ? Math.round(r.lapsDone) : null;
    if (laps == null) continue;
    const prev = state.prevLaps[key];

    if (prev === undefined) { state.prevLaps[key] = laps; continue; } // ilk görüş: yazma
    if (laps < prev) {                                                // gerileme (araç reset)
      clears.keys.push(key); state.prevLaps[key] = laps; continue;
    }
    if (laps > prev) {
      if (isNum(r.lastSec) && r.lastSec > 0) {
        writes.livelaps[`${key}/${laps}`] = +r.lastSec;
        state.captured += 1;
        if (scope.livesec && Array.isArray(r.lastSectors) && r.lastSectors.length === 3
            && r.lastSectors.every((x) => isNum(x) && x > 0)) {
          writes.livesec[`${key}/${laps}`] = r.lastSectors.map((x) => +x).join(",");
        }
        if (scope.livecond && condStr) writes.livecond[`${key}/${laps}`] = condStr;
      }
      state.prevLaps[key] = laps;
    }
  }

  const cars = Object.keys(state.prevLaps).length;
  return { writes, clears, captured: state.captured, cars };
}

/* writes içindeki bir düğüm haritasında yazılacak giriş var mı (boş obje atlanmalı). */
export const hasWrites = (m) => !!m && Object.keys(m).length > 0;
