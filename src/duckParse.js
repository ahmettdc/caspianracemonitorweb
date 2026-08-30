/* ============================================================
   duckParse — LMU DuckDB telemetri: tur özeti + meta (v1.5.1)
   ------------------------------------------------------------
   Le Mans Ultimate'in yerel telemetri kaydı (.duckdb) MoTeC .ld'nin yerini alır.
   Yapı (dosya incelemesiyle doğrulandı, §7 raporu):
     • Sürekli kanallar (channelsList): tablo yalnız `value` / `value1..4`, ZAMAN
       DAMGASI YOK → zaman = t0 + satırIndeksi / frekans.
     • Olay kanalları (eventsList): `ts` (mutlak saniye) + değer, seyrek (değişince).
     • Ana saat: `GPS Time` kanalı = mutlak seans saniyesi; t0 = GPS Time[0]
       = en küçük olay ts'i (tüm sürekli kanalların başlangıcı).

   Bu MODÜL SAF: `dataset` (duckdb.js adaptörünün materyalize ettiği düz veri) alır,
   ldParser ile BİREBİR aynı `{ lap, n, t0, tEnd, sec, official, span, fuelL, w:[4],
   pit, avgSpd, maxSpd, partial }` tur şeklini ve `{ venue, vehicle, driver, trk, amb,
   channels, ... }` meta'sını üretir → TeleTab/StintTab alt akışı değişmeden çalışır.

   dataset sözleşmesi (duckdb.js üretir):
     { meta:{<key>:value}, t0, tEnd,
       cont:{ speed,throttle,brake,rpm,steer,dist,posx,posz,fuel,trk,amb : {hz,v:[]} },
       cont4:{ wear:{hz,v:[[a],[b],[c],[d]]} },
       evt:{ lap,inpits,laptime,ls1,ls2,gear : [{ts,value}] } }
   Eksik kanal → anahtar yok (undefined). Değerler düz Number (adaptör BigInt'i çevirir).
   ============================================================ */

/* İç anahtar → gerçek DuckDB tablo adı için toleranslı regex (adaptör çözer). */
export const DUCK_CONT = {
  speed: [/^ground speed$/i, /^speed$/i],
  throttle: [/^throttle pos$/i, /^throttle/i],
  brake: [/^brake pos$/i, /^brake/i],
  rpm: [/^engine rpm$/i, /\brpm\b/i],
  steer: [/^steering pos$/i, /^steer/i],
  dist: [/^lap dist$/i, /^lap distance$/i, /dist/i],
  posx: [/^gps longitude$/i, /longitude/i],
  posz: [/^gps latitude$/i, /latitude/i],
  /* yanal ivme — GPS kanalı olmayan kayıtlarda pist şekli hız+yanal-G'den kurulur
     (ldTrace gShapeXY). Ad varyantları toleranslı (G Force Lat / Lat Accel / …). */
  latg: [/^g force lat$/i, /lat.*acc/i, /acc.*lat/i, /g[ _]?lat/i, /lateral/i],
  fuel: [/^fuel level$/i, /^fuel$/i],
  trk: [/^track temperature$/i, /track temp/i],
  amb: [/^ambient temperature$/i, /ambient temp/i],
};
export const DUCK_CONT4 = { wear: [/^tyres wear$/i, /tyre.*wear/i] };
export const DUCK_EVT = {
  lap: [/^lap$/i],
  inpits: [/^in pits$/i],
  laptime: [/^lap time$/i],
  ls1: [/^last sector1$/i],
  ls2: [/^last sector2$/i],
  gear: [/^gear$/i],
};
/* GPS Time = ana saat (t0 = ilk değeri). */
export const DUCK_CLOCK = [/^gps time$/i];

/* Sürekli kanaldan MUTLAK saniyedeki değer (kanalın kendi hz'i; t0 = seans başlangıcı). */
export function sampleContAt(ch, t0, tAbs) {
  if (!ch || !ch.v || !ch.v.length) return null;
  const i = Math.round((tAbs - t0) * ch.hz);
  if (i < 0 || i >= ch.v.length) return null;
  const v = ch.v[i];
  return Number.isFinite(v) ? v : null;
}
/* 4-köşe sürekli kanaldan [FL,FR,RL,RR] (varsayım — HUD ile doğrulanmalı). */
function sample4At(ch, t0, tAbs) {
  if (!ch || !ch.v || ch.v.length < 4) return null;
  const i = Math.round((tAbs - t0) * ch.hz);
  const n = ch.v[0].length;
  if (i < 0 || i >= n) return null;
  return [0, 1, 2, 3].map((k) => {
    const v = ch.v[k][i];
    return Number.isFinite(v) ? v : null;
  });
}
/* Hız kanalında [ta,tb] penceresinin ortalama/maksimumu (km/h). */
function speedRange(ch, t0, ta, tb) {
  if (!ch || !ch.v || !ch.v.length) return { avg: null, max: null };
  const a = Math.max(0, Math.round((ta - t0) * ch.hz));
  const b = Math.min(ch.v.length - 1, Math.round((tb - t0) * ch.hz));
  let sum = 0, mx = -Infinity, n = 0;
  for (let i = a; i <= b; i++) {
    const v = ch.v[i];
    if (Number.isFinite(v)) { sum += v; if (v > mx) mx = v; n++; }
  }
  return n ? { avg: sum / n, max: mx } : { avg: null, max: null };
}
/* Olay adım-fonksiyonu: [ta,tb] aralığında "in pits" hiç 1 mi (ta'daki aktif değer dahil). */
function pitIn(evt, ta, tb) {
  if (!Array.isArray(evt) || !evt.length) return false;
  let active = 0;
  for (const e of evt) {
    if (e.ts <= ta) active = e.value;                 // ta'daki aktif değer
    else if (e.ts <= tb && e.value > 0) return true;  // aralık içinde pit
  }
  return active > 0;
}

/* Sıralı olay dizisinde (t0, tEnd] penceresine düşen son geçerli değeri döndür.
   `Last Sector1/2` gibi sektör olayları tur içinde bir kez yayınlanır → o turun sektörü. */
function evtInWindow(arr, t0, tEnd) {
  if (!Array.isArray(arr) || !arr.length) return null;
  let val = null;
  for (const e of arr) {
    if (e.ts > tEnd + 1e-6) break;            // sıralı → penceresi geçilmiş
    if (e.ts > t0) val = e.value;             // (t0, tEnd] içindeki son değer
  }
  return Number.isFinite(val) && val > 0 ? val : null;
}

/* dataset → laps[] (ldParser tur şekliyle birebir).
   Tur segmentleri `Lap` olayının ardışık ts'lerinden; resmi süre `Lap Time` olayından
   (segment sonunda yayınlanır); yoksa segment süresi (partial). Sektör süreleri (gerçek
   beacon) `Last Sector1/2` olaylarından → sectors=[s1,s2,s3] (s3 = resmi süre − s1 − s2). */
export function duckLaps(ds) {
  if (!ds || !ds.evt || !Array.isArray(ds.evt.lap) || !ds.evt.lap.length) return [];
  const lapE = ds.evt.lap.slice().sort((a, b) => a.ts - b.ts);
  const t0g = ds.t0, tEndAll = ds.tEnd;
  const spdHz = ds.cont?.speed?.hz || 10;
  /* Lap Time olayları segment SONU ts'ine göre eşlenir (ms hassasiyet → yuvarla). */
  const ltMap = new Map((ds.evt.laptime || []).map((e) => [Math.round(e.ts * 100), e.value]));
  const ls1E = (ds.evt.ls1 || []).slice().sort((a, b) => a.ts - b.ts);
  const ls2E = (ds.evt.ls2 || []).slice().sort((a, b) => a.ts - b.ts);
  const laps = [];
  for (let i = 0; i < lapE.length; i++) {
    const t0 = lapE[i].ts;
    const hasNext = i + 1 < lapE.length;
    const tEnd = hasNext ? lapE[i + 1].ts : tEndAll;
    if (!(tEnd > t0)) continue;
    const span = tEnd - t0;
    let official = null;
    if (hasNext) {
      const v = ltMap.get(Math.round(tEnd * 100));
      if (v != null && v > 20 && v < 1200) official = v;
    }
    const f0 = sampleContAt(ds.cont?.fuel, t0g, t0);
    const f1 = sampleContAt(ds.cont?.fuel, t0g, tEnd);
    const w0 = sample4At(ds.cont4?.wear, t0g, t0);
    const w1 = sample4At(ds.cont4?.wear, t0g, tEnd);
    const w = (w0 && w1)
      ? [0, 1, 2, 3].map((k) => (w0[k] != null && w1[k] != null ? +Math.abs(w1[k] - w0[k]).toFixed(2) : null))
      : [null, null, null, null];
    const { avg, max } = speedRange(ds.cont?.speed, t0g, t0, tEnd);
    /* Sektörler yalnız TAM tur için (resmi süre var): s1/s2 beacon'dan, s3 = süre−s1−s2.
       Toplam ~tutmuyorsa (glitch/eksik beacon) sectors=null → teorik en iyi bu turu atlar. */
    let sectors = null;
    if (official != null) {
      const s1 = evtInWindow(ls1E, t0, tEnd);
      const s2 = evtInWindow(ls2E, t0, tEnd);
      if (s1 != null && s2 != null) {
        const s3 = official - s1 - s2;
        if (s3 > 1 && s1 + s2 < official) sectors = [+s1.toFixed(3), +s2.toFixed(3), +s3.toFixed(3)];
      }
    }
    laps.push({
      lap: lapE[i].value, n: Math.round(span * spdHz),
      t0, tEnd,
      sec: official != null ? official : span, official, span,
      fuelL: (f0 != null && f1 != null && f0 > f1) ? +(f0 - f1).toFixed(3) : null,
      w, sectors,
      pit: pitIn(ds.evt.inpits, t0, tEnd),
      avgSpd: avg,
      maxSpd: (max != null && Number.isFinite(max)) ? max : null,
      partial: official == null,
    });
  }
  return laps.filter((l) => l.n >= 5 && l.sec != null && l.sec > 10);
}

/* dataset → meta (ldParser meta şekliyle uyumlu: venue/vehicle/driver/trk/amb/channels). */
export function duckMeta(ds) {
  const m = (ds && ds.meta) || {};
  const t0g = ds?.t0 ?? 0;
  const mid = t0g + ((ds?.tEnd ?? t0g) - t0g) / 2;
  return {
    venue: m.TrackName || m.TrackLayout || "",
    vehicle: m.CarName || "",
    driver: m.DriverName || "",
    date: m.RecordingTime || "",
    trk: sampleContAt(ds?.cont?.trk, t0g, mid),
    amb: sampleContAt(ds?.cont?.amb, t0g, mid),
    session: m.SessionType || "",
    weather: m.WeatherConditions || "",
    carClass: m.CarClass || "",
    setup: m.CarSetup || null,      // gömülü kurulum JSON (ileride Setup görüntüleyicisi)
    channels: {
      speed: !!ds?.cont?.speed, throttle: !!ds?.cont?.throttle, brake: !!ds?.cont?.brake,
      gear: !!(ds?.evt?.gear && ds.evt.gear.length), rpm: !!ds?.cont?.rpm,
      steer: !!ds?.cont?.steer, dist: !!ds?.cont?.dist,
    },
  };
}
