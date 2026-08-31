import { describe, it, expect } from "vitest";
import { emptyCurve, observeCurve, timeFracOf, curveOf, curveFill,
  timeAtDist, distAtTime, pitOutTargets, pitOutPoints,
  PIT_MIN, PIT_STEP, PIT_COUNT, CURVE_MIN_FILL } from "./pitOut";

const NB = 480;

/* SABİT HIZLI test pisti: zamanKesri === mesafeKesri. Böylece beklenen değerler
   elle hesaplanabilir. (Gerçek pistte eğri doğrusal değildir — zaten yöntemin
   tüm amacı bu.) */
const linearCurve = (nb = NB) => {
  const st = emptyCurve();
  for (let b = 0; b < nb; b += 1) observeCurve(st, b, (b + 0.5) / nb);
  return curveOf(st);
};

describe("observeCurve / curveOf", () => {
  it("kutu ortalaması tutar", () => {
    const st = emptyCurve();
    observeCurve(st, 3, 0.20);
    observeCurve(st, 3, 0.30);
    expect(curveOf(st)[3]).toBeCloseTo(0.25, 9);
  });
  it("geçersiz kutu/kesri yok sayar (uydurma örnek girmez)", () => {
    const st = emptyCurve();
    observeCurve(st, -1, 0.5);
    observeCurve(st, 1.5, 0.5);
    observeCurve(st, 2, -0.1);
    observeCurve(st, 2, 1.4);
    observeCurve(st, 2, NaN);
    expect(curveOf(st)).toBe(null);
  });
  it("hiç örnek yoksa null", () => {
    expect(curveOf(emptyCurve())).toBe(null);
    expect(curveOf(null)).toBe(null);
  });
  it("curveFill doluluk oranı verir", () => {
    const st = emptyCurve();
    for (let b = 0; b < 48; b += 1) observeCurve(st, b, b / 480);
    expect(curveFill(curveOf(st), 480)).toBeCloseTo(0.1, 9);
    expect(curveFill(null, 480)).toBe(0);
  });
});

describe("timeFracOf", () => {
  it("timeIntoLap / estLapTime", () => {
    expect(timeFracOf({ timeIntoLap: 25, estLapTime: 100 })).toBeCloseTo(0.25, 9);
  });
  it("0 GEÇERLİDİR (S/F'yi yeni geçen araç)", () => {
    expect(timeFracOf({ timeIntoLap: 0, estLapTime: 100 })).toBe(0);
  });
  it("köprünün -1 nöbetçisi ve eksik alan → null", () => {
    expect(timeFracOf({ timeIntoLap: -1, estLapTime: 100 })).toBe(null);
    expect(timeFracOf({ timeIntoLap: 25, estLapTime: -1 })).toBe(null);
    expect(timeFracOf({ timeIntoLap: 25 })).toBe(null);
    expect(timeFracOf({})).toBe(null);
    expect(timeFracOf(null)).toBe(null);
  });
  it("tur süresini aşan okuma (bozuk kare) → null", () => {
    expect(timeFracOf({ timeIntoLap: 150, estLapTime: 100 })).toBe(null);
  });
});

describe("timeAtDist / distAtTime", () => {
  const curve = linearCurve();

  it("doğrusal pistte gidiş-dönüş tutarlı", () => {
    expect(timeAtDist(curve, 0.25, NB)).toBeCloseTo(0.25, 2);
    expect(distAtTime(curve, 0.25, NB)).toBeCloseTo(0.25, 2);
  });

  it("tur başı/sonu sarmalı kabul eder", () => {
    expect(timeAtDist(curve, 1.25, NB)).toBeCloseTo(0.25, 2);
    expect(timeAtDist(curve, -0.75, NB)).toBeCloseTo(0.25, 2);
  });

  it("ters aramada yakınlık DAİRESELDİR (0.99 ile 0.01 komşu)", () => {
    // 0.999 hedefi, S/F'nin hemen ÖNCESİNE düşmeli — başa (0.0) atlamamalı
    const d = distAtTime(curve, 0.999, NB);
    expect(d).toBeGreaterThan(0.99);
  });

  it("boş kutuları atlar (en yakın DOLU kutuyu bulur)", () => {
    const sparse = curveOf((() => {
      const st = emptyCurve();
      observeCurve(st, 100, 0.2);
      observeCurve(st, 300, 0.7);
      return st;
    })());
    expect(timeAtDist(sparse, 0.21, NB)).toBe(0.2);   // 100/480 ≈ 0.208
    expect(timeAtDist(sparse, 0.63, NB)).toBe(0.7);   // 300/480 = 0.625
  });

  it("eğri yoksa null", () => {
    expect(timeAtDist(null, 0.5, NB)).toBe(null);
    expect(distAtTime(null, 0.5, NB)).toBe(null);
    expect(timeAtDist(curve, NaN, NB)).toBe(null);
  });
});

describe("pitOutTargets", () => {
  const curve = linearCurve();
  const base = { curve, nb: NB, entryFrac: 0.90, exitFrac: 0.05, lapSec: 100 };

  it("otomatik seri 15/25/35/45/55/65 üretir (TinyPedal varsayılanı)", () => {
    const out = pitOutTargets({ ...base, nowFrac: 0.80 });
    expect(out.map((x) => x.sec)).toEqual([15, 25, 35, 45, 55, 65]);
    expect(PIT_MIN).toBe(15);
    expect(PIT_STEP).toBe(10);
    expect(PIT_COUNT).toBe(6);
  });

  it("uzun durak, pistte DAHA GERİDEKİ araçların yanına çıkarır", () => {
    /* Doğrusal pist, 100 sn tur. Girişe 10 sn var (0.80 → 0.90), çıkış 0.05 (5 sn).
       T = t_exit + pitTimer − sec = 5 − 10 − sec = −5 − sec (mod 100)
       15 sn → 80 · 25 sn → 70 · 65 sn → 30  → süre uzadıkça hedef GERİ kayar. */
    const out = pitOutTargets({ ...base, nowFrac: 0.80 });
    const by = Object.fromEntries(out.map((x) => [x.sec, x.distFrac]));
    expect(by[15]).toBeCloseTo(0.80, 2);
    expect(by[25]).toBeCloseTo(0.70, 2);
    expect(by[65]).toBeCloseTo(0.30, 2);
  });

  it("tur boyunca SARMALAR (negatif zamana taşmaz)", () => {
    // çıkışa çok yakınken uzun durak tur başına sarmalı
    const out = pitOutTargets({ ...base, nowFrac: 0.895, count: 1, min: 90 });
    expect(out).toHaveLength(1);
    expect(out[0].distFrac).toBeGreaterThanOrEqual(0);
    expect(out[0].distFrac).toBeLessThanOrEqual(1);
  });

  it("eksik veride BOŞ döner (uydurma çember çizme)", () => {
    expect(pitOutTargets({ ...base, nowFrac: 0.8, curve: null })).toEqual([]);
    expect(pitOutTargets({ ...base, nowFrac: 0.8, lapSec: 0 })).toEqual([]);
    expect(pitOutTargets({ ...base, nowFrac: 0.8, nb: 0 })).toEqual([]);
  });

  it("eğri tamamen boşsa hiçbir hedef üretmez", () => {
    expect(pitOutTargets({ ...base, nowFrac: 0.8, curve: {} })).toEqual([]);
  });

  it("aday sayısı/adımı ayarlanabilir", () => {
    const out = pitOutTargets({ ...base, nowFrac: 0.8, min: 20, step: 5, count: 3 });
    expect(out.map((x) => x.sec)).toEqual([20, 25, 30]);
  });
});

/* pitOutPoints — ekrana çizilecek noktalar + TÜM koşul kapıları. Bu blok özellikle
   POZİTİF yolu doğrular: yukarıdaki "çizilmez" testleri tek başına özellik
   tamamen silinse de geçerdi. */
describe("pitOutPoints", () => {
  const curve = linearCurve();
  const pitFr = { entry: 0.90, exit: 0.05 };
  const me = { lapDist: 0.80 * 5000, avg5Sec: 100 };
  const base = { me, curve, nb: NB, pitFr, trackLength: 5000, lapSec: 100 };

  it("POZİTİF: koşullar tamsa 6 nokta üretir ve harita kutusu verir", () => {
    const pts = pitOutPoints(base);
    expect(pts.map((p) => p.sec)).toEqual([15, 25, 35, 45, 55, 65]);
    for (const p of pts) {
      expect(Number.isInteger(p.bin)).toBe(true);
      expect(p.bin).toBeGreaterThanOrEqual(0);
      expect(p.bin).toBeLessThan(NB);
      expect(p.distFrac).toBeGreaterThanOrEqual(0);
      expect(p.distFrac).toBeLessThanOrEqual(1);
    }
  });

  it("POZİTİF: bin, distFrac ile tutarlı (harita kutusuna doğru düşer)", () => {
    for (const p of pitOutPoints(base)) {
      expect(p.bin).toBe(Math.floor(p.distFrac * NB) % NB);
    }
  });

  it("pit giriş/çıkışı gözlenmemişse BOŞ (varsayılan oran uydurulmaz)", () => {
    expect(pitOutPoints({ ...base, pitFr: null })).toEqual([]);
    expect(pitOutPoints({ ...base, pitFr: { entry: 0.9, exit: null } })).toEqual([]);
    expect(pitOutPoints({ ...base, pitFr: { entry: null, exit: 0.05 } })).toEqual([]);
  });

  it("oyuncu / tempo / pist uzunluğu yoksa BOŞ", () => {
    expect(pitOutPoints({ ...base, me: null })).toEqual([]);
    expect(pitOutPoints({ ...base, lapSec: 0 })).toEqual([]);
    expect(pitOutPoints({ ...base, trackLength: 0 })).toEqual([]);
  });

  it("eğri SEYREKSE çizilmez (yanıltıcı tahmin üretme)", () => {
    const sparse = curveOf((() => {
      const st = emptyCurve();
      for (let b = 0; b < 40; b += 1) observeCurve(st, b, (b + 0.5) / NB);  // %8
      return st;
    })());
    expect(pitOutPoints({ ...base, curve: sparse })).toEqual([]);
    // eşiği düşürünce aynı eğriyle üretir → engelin sebebi gerçekten doluluk
    expect(pitOutPoints({ ...base, curve: sparse, minFill: 0.05 }).length).toBe(6);
    expect(CURVE_MIN_FILL).toBe(0.35);
  });

  it("bozuk lapDist ile çökmez", () => {
    expect(pitOutPoints({ ...base, me: { lapDist: NaN, avg5Sec: 100 } })).toEqual([]);
  });

  /* Number(null)===0 tuzağı (CLAUDE.md §1): açık kontrol olmadan lapDist'i EKSİK
     oyuncu "S/F çizgisinde" sayılır ve altı çember de makul GÖRÜNEN ama tamamen
     uydurma konumlara çizilirdi. */
  it("lapDist EKSİKSE hiç çember üretmez (S/F sanılmaz)", () => {
    expect(pitOutPoints({ ...base, me: { avg5Sec: 100 } })).toEqual([]);
    expect(pitOutPoints({ ...base, me: { lapDist: null, avg5Sec: 100 } })).toEqual([]);
    expect(pitOutPoints({ ...base, me: { lapDist: "", avg5Sec: 100 } })).toEqual([]);
    // 0 GEÇERLİDİR: araç gerçekten S/F çizgisinde olabilir
    expect(pitOutPoints({ ...base, me: { lapDist: 0, avg5Sec: 100 } }).length).toBe(6);
  });
});
