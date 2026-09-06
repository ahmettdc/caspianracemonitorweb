/* ============================================================
   duckTrace — DuckDB ham kanal İZLERİ (v1.5.1)
   ------------------------------------------------------------
   ldTrace.buildTrace'in DuckDB karşılığı: bir turun hız/gaz/fren/vites/RPM/direksiyon
   eğrilerini ortak MESAFE ızgarasına yeniden örnekler ve BİREBİR aynı iz nesnesini
   üretir → ldTrace.buildCompare (kaynak-bağımsız) iki tarafı birleştirir. Böylece .ld
   ve .duckdb karışık bile karşılaştırılabilir.

   Fark yalnız KAYNAK: .ld byte-slice reader'ı yerine burada bellek-içi diziler (adaptör
   tüm kanalı bir kez çeker). Sürekli kanal → zaman = t0 + i/hz; olay kanalı (vites) →
   adım fonksiyonu (ts ≤ tAbs son değer). Pist haritası GERÇEK GPS'ten (lon=x, lat=y) →
   yanal-G ile yeniden kurmaya gerek yok.
   ============================================================ */
import { sampleContAt } from "./duckParse";
import { gShapeXY, sampleArrAtTime } from "./ldTrace";
export { buildCompare, sectorOf, sectorMarks } from "./ldTrace";

/* dataset → iz okuyucuları (sürekli = {hz}, vites = olay adım). */
export function buildDuckReaders(ds) {
  if (!ds || !ds.cont) return null;
  const cont = (k) => (ds.cont[k] ? { kind: "cont", hz: ds.cont[k].hz, v: ds.cont[k].v } : null);
  const gear = ds.evt?.gear?.length
    ? { kind: "evt", e: ds.evt.gear.slice().sort((a, b) => a.ts - b.ts) } : null;
  return {
    t0: ds.t0,
    speed: cont("speed"), throttle: cont("throttle"), brake: cont("brake"),
    rpm: cont("rpm"), steer: cont("steer"), dist: cont("dist"),
    posx: cont("posx"), posz: cont("posz"), latg: cont("latg"), gear,
  };
}

/* Bir okuyucudan MUTLAK saniyedeki değer (sürekli = index; olay = adım). */
function at(r, t0, tAbs) {
  if (!r) return null;
  if (r.kind === "cont") return sampleContAt(r, t0, tAbs);
  // olay adım-fonksiyonu (ikili arama; ts ≤ tAbs son değer)
  const e = r.e;
  if (!e.length) return null;
  if (tAbs < e[0].ts) return e[0].value;
  let lo = 0, hi = e.length - 1, ans = e[0].value;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (e[m].ts <= tAbs) { ans = e[m].value; lo = m + 1; } else hi = m - 1; }
  return ans;
}

/* 0..1 aralığındaki kanalı yüzdeye çevir (LMU zaten 0..100 verir → 1). */
function pctScale(r, t0, ta, tb) {
  if (!r) return 1;
  let mx = 0;
  const steps = 40, dt = (tb - ta) / steps;
  for (let i = 0; i <= steps; i++) { const v = at(r, t0, ta + i * dt); if (Number.isFinite(v)) mx = Math.max(mx, Math.abs(v)); }
  return mx > 0 && mx <= 1.5 ? 100 : 1;
}

/* Monoton rawDist üzerinden dGrid mesafelerine karşılık gelen zamanı interpole et. */
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

/* Bir turun izini ortak mesafe ızgarasında üret (ldTrace.buildTrace ile AYNI şekil). */
export function buildDuckTrace(readers, lap, N = 600) {
  if (!readers || !lap || !(lap.tEnd > lap.t0)) return null;
  const t0g = readers.t0;
  const base = readers.speed || readers.throttle || readers.rpm || readers.brake
    || readers.steer || readers.dist;
  if (!base) return null;
  const freq = base.hz || 20;
  const t0 = lap.t0, tEnd = lap.tEnd;
  const M = Math.max(2, Math.min(8000, Math.round((tEnd - t0) * freq)));

  const rawT = Array.from({ length: M });
  const rawDist = Array.from({ length: M });
  const rawV = Array.from({ length: M });
  const dt = (tEnd - t0) / (M - 1);
  const hasDist = !!readers.dist;
  const d0dist = hasDist ? at(readers.dist, t0g, t0) : null;
  let cum = 0, prevMs = 0;
  let distOk = hasDist && Number.isFinite(d0dist);
  for (let j = 0; j < M; j++) {
    const tAbs = t0 + j * dt;
    rawT[j] = tAbs;
    const sp = readers.speed ? at(readers.speed, t0g, tAbs) : null;   // km/h
    const ms = Number.isFinite(sp) ? Math.max(0, sp) / 3.6 : prevMs;
    rawV[j] = ms;
    if (distOk) {
      const dv = at(readers.dist, t0g, tAbs);
      let d = Number.isFinite(dv) ? dv - d0dist : (rawDist[j - 1] ?? 0);
      /* S/F RESETİ SON ÖRNEĞE DÜŞÜYOR (v2.4.1). Izgara [t0, tEnd] KAPALI
         aralıkta kuruluyor; son örnek (j = M-1) tam olarak bir sonraki `Lap`
         olayının ts'ine denk gelir ve orada oyunun `Lap Dist` kanalı S/F
         çizgisinde SIFIRLANMIŞTIR. Bunu "mesafe geriye gitti" sayıp tüm turu
         hız entegrasyonuyla yeniden kurmak, oyunun verdiği GERÇEK mesafeyi
         çöpe atıp yerine MODELLENMİŞ bir mesafe koyuyordu (CLAUDE.md §1) —
         üstelik S/F geçişinin ızgaraya göre alt-örnek konumu turdan tura
         değiştiği için aynı stintte bazı turlar gerçek, bazıları modellenmiş
         mesafeyle ölçekleniyordu (ölçüldü: 5000 m'lik turda 4995 ↔ 5278 m).
         Tur ORTASINDAKİ gerçek geri sıçrama hâlâ yedeğe düşürür; yalnız son
         örnek tek adımlık trapez ile ileri taşınır. */
      if (j > 0 && d < rawDist[j - 1] - 1) {
        if (j < M - 1) distOk = false;                 // tur ortası → hız entegrasyonu
        else d = rawDist[j - 1] + ((prevMs + ms) / 2) * dt;
      }
      if (distOk) rawDist[j] = d;
    }
    if (!distOk) {
      if (j > 0) cum += ((prevMs + ms) / 2) * dt;
      rawDist[j] = cum;
    }
    prevMs = ms;
  }
  if (hasDist && !distOk) {
    cum = 0; prevMs = 0;
    for (let j = 0; j < M; j++) {
      const sp = readers.speed ? at(readers.speed, t0g, rawT[j]) : null;
      const ms = Number.isFinite(sp) ? Math.max(0, sp) / 3.6 : prevMs;
      if (j > 0) cum += ((prevMs + ms) / 2) * dt;
      rawDist[j] = cum; prevMs = ms;
    }
  }
  let len = rawDist[M - 1];
  let distUnit = readers.speed || (hasDist && distOk) ? "m" : "frac";
  if (!(len > 0)) {
    for (let j = 0; j < M; j++) rawDist[j] = j / (M - 1);
    len = 1; distUnit = "frac";
  }

  const dGrid = Array.from({ length: N });
  for (let k = 0; k < N; k++) dGrid[k] = (len * k) / (N - 1);
  const tGrid = resampleTime(rawT, rawDist, dGrid);

  const thS = pctScale(readers.throttle, t0g, t0, tEnd);
  const brS = pctScale(readers.brake, t0g, t0, tEnd);
  const out = {
    dist: distUnit === "frac" ? dGrid.map((d) => d * 100) : dGrid,
    distUnit, len,
    time: tGrid.map((t) => t - t0),
    frac: dGrid.map((d) => d / len),
  };
  const chOf = (r, scale = 1) => (r ? tGrid.map((t) => {
    const v = at(r, t0g, t); return Number.isFinite(v) ? v * scale : null;
  }) : null);
  if (readers.speed) out.speed = chOf(readers.speed);
  if (readers.throttle) out.throttle = chOf(readers.throttle, thS);
  if (readers.brake) out.brake = chOf(readers.brake, brS);
  if (readers.gear) out.gear = tGrid.map((t) => { const v = at(readers.gear, t0g, t); return Number.isFinite(v) ? Math.round(v) : null; });
  if (readers.rpm) out.rpm = chOf(readers.rpm);
  if (readers.steer) out.steer = chOf(readers.steer);

  // pist haritası — öncelik: gerçek GPS (lon=x, lat=y) → yoksa hız+yanal-G ile
  // yeniden kur (ldTrace gShapeXY — .ld ile aynı desen). UI fit-to-box normalize eder.
  if (readers.posx && readers.posz) {
    const gx = tGrid.map((t) => at(readers.posx, t0g, t));
    const gy = tGrid.map((t) => at(readers.posz, t0g, t));
    const fin = (a) => a.filter(Number.isFinite);
    const span = (a) => { const f = fin(a); return f.length ? Math.max(...f) - Math.min(...f) : NaN; };
    if (Number.isFinite(span(gx)) && (span(gx) > 0 || span(gy) > 0)) {
      /* 1° boylam = cos(enlem) × 1° enlem — ham dereceler oranlanmazsa pist dikeyde
         ~%35 uzar (Le Mans). Boylamı cos(ortalama enlem) ile ölçekle → metrik oran. */
      const latF = fin(gy);
      const latMean = latF.length ? latF.reduce((a, b) => a + b, 0) / latF.length : 0;
      const k = Math.abs(latMean) <= 90 ? (Math.cos((latMean * Math.PI) / 180) || 1) : 1;
      out.x = gx.map((v) => (Number.isFinite(v) ? v * k : v));
      out.y = gy;
      out.mapSrc = "gps";
    }
  }
  if (!out.x && readers.latg && readers.speed) {
    const la = Array.from({ length: M }, (_, j) => at(readers.latg, t0g, rawT[j]));
    const g = gShapeXY(rawV, la, dt);
    if (g) {
      out.x = tGrid.map((tg) => sampleArrAtTime(g.x, t0, dt, tg));
      out.y = tGrid.map((tg) => sampleArrAtTime(g.y, t0, dt, tg));
      out.mapSrc = "g";
    }
  }
  return out;
}
