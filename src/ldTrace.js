/* ============================================================
   ldTrace — .ld ham kanal İZLERİ + tur karşılaştırma + zaman-delta (v1.4.111)
   ------------------------------------------------------------
   ldParser'ın seçici okumasını (readChannel/sampleAt) yeniden kullanarak bir turun
   hız/gaz/fren/vites/RPM/direksiyon eğrilerini çıkarır ve iki turu MESAFE ekseninde
   üst üste bindirir. İki tur farklı sürede olduğundan zaman ekseni kıyası bozardı →
   ortak mesafe ızgarasına (0..turUzunluğu, N nokta) yeniden örnekleme yapılır.

   Zaman-delta: ortak tur-kesri boyunca Δt = time_B − time_A (kümülatif) → "B, A'ya
   göre nerede zaman kazanıyor/kaybediyor" (klasik MoTeC time-variance). Uç değer ≈
   iki turun süre farkı.

   Görünüm-amaçlı: hiçbir şey Firebase'e yazılmaz; okuyucular dosya başına bir kez
   kurulup (buildReaders) her tur için yeniden örneklenir (kanal blokları birkaç MB,
   tam dosya değil).
   ============================================================ */
import { readChannel, findChan, sampleAt, TRACE_CHANS } from "./ldParser";

export const TRACE_KEYS = ["speed", "throttle", "brake", "gear", "rpm", "steer", "dist"];

/* Kanal okuyucularını dosya başına BİR kez kur (çağıran önbelleğe alır). header =
   parseLd'nin döndürdüğü { chans, order }. Her okuyucu o kanalın bayt bloğu (birkaç MB)
   ya da yoksa null. */
export async function buildReaders(file, header) {
  if (!file || !header?.chans || !header?.order) return null;
  const readers = {};
  for (const key of TRACE_KEYS) {
    const c = findChan(header.chans, header.order, ...TRACE_CHANS[key]);
    readers[key] = c ? await readChannel(file, c) : null;
  }
  return readers;
}

/* Bir okuyucudan MUTLAK saniyedeki değeri örnekle (kanalın kendi freq'iyle). */
const at = (r, tAbs) => (r ? sampleAt(r, Math.round(tAbs * r.c.freq)) : null);

/* Kanal 0..1 aralığındaysa yüzdeye çevir (gaz/fren bazı .ld'lerde 0..1). */
function pctScale(r, t0, tEnd) {
  if (!r) return 1;
  let mx = 0;
  const steps = 40, dt = (tEnd - t0) / steps;
  for (let i = 0; i <= steps; i++) { const v = at(r, t0 + i * dt); if (Number.isFinite(v)) mx = Math.max(mx, Math.abs(v)); }
  return mx > 0 && mx <= 1.5 ? 100 : 1;
}

/* Monoton artan rawDist üzerinden dGrid mesafelerine karşılık gelen zamanı interpole et. */
function resampleTime(rawT, rawDist, dGrid) {
  const out = Array.from({ length: dGrid.length });
  let j = 0;
  for (let k = 0; k < dGrid.length; k++) {
    const d = dGrid[k];
    while (j < rawDist.length - 2 && rawDist[j + 1] < d) j++;
    const d0 = rawDist[j], d1 = rawDist[j + 1] ?? d0;
    const t0 = rawT[j], t1 = rawT[j + 1] ?? t0;
    const f = d1 > d0 ? (d - d0) / (d1 - d0) : 0;
    out[k] = t0 + f * (t1 - t0);
  }
  return out;
}

/* Bir turun izini ortak mesafe ızgarasında üret.
   lap: { t0, tEnd }. Dönen: { dist:[m ya da %], distUnit, time:[sn, tur başından],
   frac:[0..1], speed/throttle/brake/gear/rpm/steer:[] (yalnız var olan kanallar),
   len (tur mesafesi) }. Kanal/okuyucu yoksa null. */
export function buildTrace(readers, lap, N = 600) {
  if (!readers || !lap || !(lap.tEnd > lap.t0)) return null;
  const base = readers.speed || readers.throttle || readers.rpm || readers.brake
    || readers.gear || readers.steer || readers.dist;
  if (!base) return null;
  const freq = base.c.freq || 20;
  const t0 = lap.t0, tEnd = lap.tEnd;
  const M = Math.max(2, Math.min(8000, Math.round((tEnd - t0) * freq)));

  // ham örnek zamanları (mutlak) + mesafe
  const rawT = Array.from({ length: M });
  const rawDist = Array.from({ length: M });
  const dt = (tEnd - t0) / (M - 1);
  const hasDist = !!readers.dist;
  let d0dist = hasDist ? at(readers.dist, t0) : null;
  let cum = 0, prevMs = 0;
  let distOk = hasDist && Number.isFinite(d0dist);
  for (let j = 0; j < M; j++) {
    const tAbs = t0 + j * dt;
    rawT[j] = tAbs;
    if (distOk) {
      const dv = at(readers.dist, tAbs);
      rawDist[j] = Number.isFinite(dv) ? dv - d0dist : (rawDist[j - 1] ?? 0);
      // mesafe kanalı geriye giderse (tur başı reset / glitch) → hız entegrasyonuna düş
      if (j > 0 && rawDist[j] < rawDist[j - 1] - 1) { distOk = false; }
    }
    if (!distOk) {
      const sp = readers.speed ? at(readers.speed, tAbs) : null;   // km/h
      const ms = Number.isFinite(sp) ? Math.max(0, sp) / 3.6 : prevMs;
      if (j > 0) cum += ((prevMs + ms) / 2) * dt;                  // trapez
      rawDist[j] = cum;
      prevMs = ms;
    }
  }
  // mesafe kanalı yarıda bozulduysa baştan hız entegrasyonuyla yeniden kur
  if (hasDist && !distOk) {
    cum = 0; prevMs = 0;
    for (let j = 0; j < M; j++) {
      const sp = readers.speed ? at(readers.speed, rawT[j]) : null;
      const ms = Number.isFinite(sp) ? Math.max(0, sp) / 3.6 : prevMs;
      if (j > 0) cum += ((prevMs + ms) / 2) * dt;
      rawDist[j] = cum; prevMs = ms;
    }
  }
  let len = rawDist[M - 1];
  let distUnit = readers.speed || (hasDist && distOk) ? "m" : "frac";
  if (!(len > 0)) { // ne mesafe ne hız → tur-kesri yedeği
    for (let j = 0; j < M; j++) rawDist[j] = j / (M - 1);
    len = 1; distUnit = "frac";
  }

  const dGrid = Array.from({ length: N });
  for (let k = 0; k < N; k++) dGrid[k] = (len * k) / (N - 1);
  const tGrid = resampleTime(rawT, rawDist, dGrid);

  const thS = pctScale(readers.throttle, t0, tEnd);
  const brS = pctScale(readers.brake, t0, tEnd);
  const out = {
    dist: distUnit === "frac" ? dGrid.map((d) => d * 100) : dGrid,
    distUnit, len,
    time: tGrid.map((t) => t - t0),
    frac: dGrid.map((d) => d / len),
  };
  const chOf = (r, scale = 1) => (r ? tGrid.map((t) => {
    const v = at(r, t); return Number.isFinite(v) ? v * scale : null;
  }) : null);
  if (readers.speed) out.speed = chOf(readers.speed);
  if (readers.throttle) out.throttle = chOf(readers.throttle, thS);
  if (readers.brake) out.brake = chOf(readers.brake, brS);
  if (readers.gear) out.gear = readers.gear ? tGrid.map((t) => { const v = at(readers.gear, t); return Number.isFinite(v) ? Math.round(v) : null; }) : null;
  if (readers.rpm) out.rpm = chOf(readers.rpm);
  if (readers.steer) out.steer = chOf(readers.steer);
  return out;
}

/* İki izi recharts için TEK diziye birleştir + zaman-delta + sektör farkları.
   Kesir-hizalı (index k = tur kesri) → farklı tur uzunlukları sorun olmaz.
   Dönen: { data:[{d, frac, spA,spB, thA,thB, brA,brB, gA,gB, rpmA,rpmB, stA,stB, dt}],
   chans:{speed,throttle,...} (ikisinde de var olanlar), sectors:[{sec,dA,dB,diff}],
   distUnit, totalDelta }. */
export function buildCompare(a, b) {
  if (!a || !b) return null;
  const N = Math.min(a.dist.length, b.dist.length);
  const has = (k) => !!(a[k] && b[k]);
  const chans = { speed: has("speed"), throttle: has("throttle"), brake: has("brake"),
    gear: has("gear"), rpm: has("rpm"), steer: has("steer") };
  const data = Array.from({ length: N });
  for (let k = 0; k < N; k++) {
    const dt = (b.time[k] ?? 0) - (a.time[k] ?? 0);
    data[k] = {
      d: a.dist[k], frac: (a.frac[k] ?? 0) * 100, dt,
      spA: a.speed?.[k] ?? null, spB: b.speed?.[k] ?? null,
      thA: a.throttle?.[k] ?? null, thB: b.throttle?.[k] ?? null,
      brA: a.brake?.[k] ?? null, brB: b.brake?.[k] ?? null,
      gA: a.gear?.[k] ?? null, gB: b.gear?.[k] ?? null,
      rpmA: a.rpm?.[k] ?? null, rpmB: b.rpm?.[k] ?? null,
      stA: a.steer?.[k] ?? null, stB: b.steer?.[k] ?? null,
    };
  }
  // sektör farkları: tur-kesri üçlüsü (S1/S2/S3 kanalı .ld'de güvenilir değil)
  const at3 = (arr, f) => arr[Math.min(arr.length - 1, Math.round(f * (arr.length - 1)))] ?? 0;
  const sectors = [0, 1, 2].map((i) => {
    const f0 = i / 3, f1 = (i + 1) / 3;
    const dA = at3(a.time, f1) - at3(a.time, f0);
    const dB = at3(b.time, f1) - at3(b.time, f0);
    return { sec: i + 1, dA, dB, diff: dB - dA };
  });
  return { data, chans, sectors, distUnit: a.distUnit, totalDelta: data.length ? data[N - 1].dt : 0 };
}
