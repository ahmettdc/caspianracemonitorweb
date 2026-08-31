import { describe, it, expect } from "vitest";
import { wrapDist, wrapTime, relGapSec, refLap, relativeRows } from "./liveRelative";

const L = 1000;                       // 1 km'lik test pisti
const row = (c) => ({ c });

describe("wrapDist", () => {
  it("düz fark (yarım turdan kısa)", () => {
    expect(wrapDist(100, 300, L)).toBe(200);     // other ileride
    expect(wrapDist(300, 100, L)).toBe(-200);    // other geride
  });
  it("S/F çizgisi etrafında SARMALAR (en kısa yol)", () => {
    // ben 950'de, rakip 50'de → ham fark −900 ama gerçekte 100 m ÖNÜMDE
    expect(wrapDist(950, 50, L)).toBe(100);
    // ben 50'de, rakip 950'de → gerçekte 100 m ARKAMDA
    expect(wrapDist(50, 950, L)).toBe(-100);
  });
  it("tam yarım turda taşmaz", () => {
    expect(Math.abs(wrapDist(0, 500, L))).toBe(500);
  });
  it("geçersiz girdide null", () => {
    expect(wrapDist(100, 300, 0)).toBe(null);
    expect(wrapDist(null, 300, L)).toBe(null);
    expect(wrapDist(100, undefined, L)).toBe(null);
  });
});

describe("relGapSec", () => {
  it("ÖNDEKİ rakip NEGATİF, arkadaki POZİTİF (TinyPedal konvansiyonu)", () => {
    // 100 m ileride, 100 sn'lik turda 1000 m → 10 sn
    expect(relGapSec(0, 100, L, 100)).toBeCloseTo(-10, 6);
    expect(relGapSec(100, 0, L, 100)).toBeCloseTo(10, 6);
  });
  it("sarmalanmış farkı da doğru çevirir", () => {
    expect(relGapSec(950, 50, L, 100)).toBeCloseTo(-10, 6);
  });
  it("referans tur yoksa null", () => {
    expect(relGapSec(0, 100, L, 0)).toBe(null);
    expect(relGapSec(0, 100, L, null)).toBe(null);
  });
});

describe("refLap", () => {
  it("AVG5 → AVG → son tur → en iyi sırasıyla düşer", () => {
    expect(refLap({ avg5Sec: 91, avgSec: 92, lastSec: 93, bestSec: 90 })).toBe(91);
    expect(refLap({ avgSec: 92, lastSec: 93, bestSec: 90 })).toBe(92);
    expect(refLap({ lastSec: 93, bestSec: 90 })).toBe(93);
    expect(refLap({ bestSec: 90 })).toBe(90);
    expect(refLap({})).toBe(null);
    expect(refLap(null)).toBe(null);
  });
  it("geçersiz (0/negatif) değerleri atlar", () => {
    expect(refLap({ avg5Sec: 0, avgSec: -1, lastSec: 93 })).toBe(93);
  });
});

/* ---- ZAMAN ALANI yolu (v2.3.0 birincil) — TinyPedal module_relative.py yöntemi ----
   diff = other.mTimeIntoLap − me.mTimeIntoLap, mEstimatedLapTime modülünde sarmalı. */
describe("wrapTime", () => {
  const L = 100;   // 100 sn'lik tur

  it("ÖNDEKİ rakip NEGATİF, arkadaki POZİTİF", () => {
    expect(wrapTime(50, 60, L)).toBeCloseTo(-10, 9);
    expect(wrapTime(50, 40, L)).toBeCloseTo(10, 9);
  });

  it("S/F çizgisi etrafında sarmalar", () => {
    expect(wrapTime(95, 5, L)).toBeCloseTo(-10, 9);    // rakip S/F'yi geçmiş, önümde
    expect(wrapTime(5, 95, L)).toBeCloseTo(10, 9);     // ben geçmişim, o arkamda
  });

  it("yarım turdan uzağı KISA YOLDAN ölçer", () => {
    // rakip 60 sn ileride = aslında 40 sn arkamda (kısa yol)
    expect(wrapTime(0, 60, L)).toBeCloseTo(40, 9);
  });

  it("timeIntoLap 0 GEÇERLİDİR (S/F'yi yeni geçen araç), 'yok' sayılmaz", () => {
    expect(wrapTime(0, 10, L)).toBeCloseTo(-10, 9);
    expect(wrapTime(10, 0, L)).toBeCloseTo(10, 9);
  });

  it("eksik/geçersiz veride null (uydurma yapmaz)", () => {
    expect(wrapTime(null, 10, L)).toBe(null);
    expect(wrapTime(10, null, L)).toBe(null);
    expect(wrapTime(10, 20, 0)).toBe(null);
    expect(wrapTime(10, 20, null)).toBe(null);
  });

  it("köprünün -1 nöbetçisi 'veri yok' demektir, geçerli zaman DEĞİL", () => {
    expect(wrapTime(-1, 10, L)).toBe(null);
    expect(wrapTime(10, -1, L)).toBe(null);
    expect(wrapTime(10, 20, -1)).toBe(null);
  });
});

describe("relativeRows — zaman yolu vs mesafe yedeği", () => {
  const row = (c) => ({ c });

  /* Bu test yöntem değişikliğinin ASIL sebebini kilitler: mesafe oranı sabit hız
     varsayar. Rakip pistin %10'u kadar ilerideyse eski hesap her zaman
     "0.1 × turSüresi" der; oyunun kendi zaman alanı ise gerçek süreyi verir
     (yavaş bölümde çok daha fazla). */
  it("zaman alanı varsa MESAFE ORANINDAN farklı (ve doğru) sonuç verir", () => {
    const me = { carId: 1, lapDist: 0, timeIntoLap: 0, estLapTime: 100, avg5Sec: 100 };
    // rakip turun %10'u kadar ilerde AMA yavaş bölümde: 25 sn ilerde
    const opp = { carId: 2, lapDist: 500, timeIntoLap: 25, estLapTime: 100 };
    const out = relativeRows([row(me), row(opp)], me, 5000, 3, 3);
    const rs = out.find((x) => x.r.c.carId === 2).relSec;
    expect(rs).toBeCloseTo(-25, 6);      // gerçek: 25 sn önde
    expect(rs).not.toBeCloseTo(-10, 1);  // mesafe oranı yanlışlıkla 10 sn derdi
  });

  it("zaman alanı YOKSA mesafe yedeğine düşer (eski köprü .exe)", () => {
    const me = { carId: 1, lapDist: 0, avg5Sec: 100 };
    const opp = { carId: 2, lapDist: 500 };
    const out = relativeRows([row(me), row(opp)], me, 5000, 3, 3);
    expect(out.find((x) => x.r.c.carId === 2).relSec).toBeCloseTo(-10, 6);
  });

  it("zaman alanı varken pist uzunluğu GEREKMEZ", () => {
    const me = { carId: 1, timeIntoLap: 50, estLapTime: 100 };
    const opp = { carId: 2, timeIntoLap: 60, estLapTime: 100 };
    const out = relativeRows([row(me), row(opp)], me, 0, 3, 3);
    expect(out.map((x) => x.r.c.carId)).toEqual([2, 1]);
    expect(out.find((x) => x.r.c.carId === 2).relSec).toBeCloseTo(-10, 6);
  });

  it("-1 nöbetçisi taşıyan araç mesafe yedeğine düşer, zaman sanılmaz", () => {
    const me = { carId: 1, lapDist: 0, timeIntoLap: 0, estLapTime: 100, avg5Sec: 100 };
    const sentinel = { carId: 3, lapDist: 1000, timeIntoLap: -1, estLapTime: -1 };
    const out = relativeRows([row(me), row(sentinel)], me, 5000, 3, 3);
    // -1 zaman sanılsaydı ~+1 sn çıkardı; mesafe yedeği doğru −20 verir
    expect(out.find((x) => x.r.c.carId === 3).relSec).toBeCloseTo(-20, 6);
  });

  it("TEK BİR araçta zaman alanı eksikse yalnız O satır mesafeye düşer", () => {
    const me = { carId: 1, lapDist: 0, timeIntoLap: 0, estLapTime: 100, avg5Sec: 100 };
    const withTime = { carId: 2, lapDist: 500, timeIntoLap: 25, estLapTime: 100 };
    const noTime = { carId: 3, lapDist: 1000 };          // timeIntoLap yok
    const out = relativeRows([row(me), row(withTime), row(noTime)], me, 5000, 3, 3);
    const by = Object.fromEntries(out.map((x) => [x.r.c.carId, x.relSec]));
    expect(by[2]).toBeCloseTo(-25, 6);    // zaman yolu
    expect(by[3]).toBeCloseTo(-20, 6);    // mesafe yedeği (1000/5000 × 100)
  });

  it("zaman yolunda sıra da doğru (önden arkaya)", () => {
    const me = { carId: 5, timeIntoLap: 50, estLapTime: 100 };
    const f = [
      row({ carId: 1, timeIntoLap: 70, estLapTime: 100 }),   // 20 sn önde
      row({ carId: 2, timeIntoLap: 55, estLapTime: 100 }),   // 5 sn önde
      row(me),
      row({ carId: 3, timeIntoLap: 45, estLapTime: 100 }),   // 5 sn arkada
      row({ carId: 4, timeIntoLap: 30, estLapTime: 100 }),   // 20 sn arkada
    ];
    expect(relativeRows(f, me, 5000, 3, 3).map((x) => x.r.c.carId))
      .toEqual([1, 2, 5, 3, 4]);
  });
});

describe("relativeRows", () => {
  const me = { carId: 5, lapDist: 500, avg5Sec: 100, isPlayer: true };
  const field = [
    row({ carId: 1, lapDist: 700 }),   // 200 m önde
    row({ carId: 2, lapDist: 600 }),   // 100 m önde
    row(me),                            // ben
    row({ carId: 3, lapDist: 400 }),   // 100 m arkada
    row({ carId: 4, lapDist: 300 }),   // 200 m arkada
  ];

  it("pistte ÖNDEN ARKAYA sıralar ve oyuncuyu içerir", () => {
    const out = relativeRows(field, me, L, 3, 3);
    expect(out.map((x) => x.r.c.carId)).toEqual([1, 2, 5, 3, 4]);
    expect(out.find((x) => x.r.c.carId === 5).relSec).toBe(0);
  });

  it("pencereyi ahead/behind ile sınırlar", () => {
    const out = relativeRows(field, me, L, 1, 1);
    expect(out.map((x) => x.r.c.carId)).toEqual([2, 5, 3]);
  });

  it("işaretler doğru: önde negatif, arkada pozitif", () => {
    const out = relativeRows(field, me, L, 3, 3);
    const by = Object.fromEntries(out.map((x) => [x.r.c.carId, x.relSec]));
    expect(by[2]).toBeCloseTo(-10, 6);   // 100 m önde
    expect(by[3]).toBeCloseTo(10, 6);    // 100 m arkada
  });

  it("SIRALAMADA uzak ama PİSTTE yakın (tur-altı) aracı yakalar", () => {
    // tur-altı araç sıralamada en sonda ama pistte hemen önümüzde
    const lapped = row({ carId: 9, lapDist: 520, pos: 40 });
    const out = relativeRows([...field, lapped], me, L, 1, 1);
    expect(out.map((x) => x.r.c.carId)).toEqual([9, 5, 3]);
  });

  it("pit/garajdaki araçları eler (pist boşluğunu yanlış gösterirler)", () => {
    const inPit = row({ carId: 8, lapDist: 550, inPits: true });
    const inGarage = row({ carId: 7, lapDist: 560, location: "GARAGE" });
    const out = relativeRows([...field, inPit, inGarage], me, L, 3, 3);
    expect(out.map((x) => x.r.c.carId)).not.toContain(8);
    expect(out.map((x) => x.r.c.carId)).not.toContain(7);
  });

  it("oyuncu pit'te olsa bile KENDİSİ listede kalır", () => {
    const pitMe = { carId: 5, lapDist: 500, avg5Sec: 100, inPits: true };
    const out = relativeRows([row(pitMe), row({ carId: 2, lapDist: 600 })], pitMe, L, 1, 1);
    expect(out.map((x) => x.r.c.carId)).toContain(5);
  });

  it("veri eksikse boş döner (uydurma yapma)", () => {
    expect(relativeRows(field, null, L)).toEqual([]);
    expect(relativeRows(field, me, 0)).toEqual([]);
    expect(relativeRows(null, me, L)).toEqual([]);
    // oyuncu sahada yoksa
    expect(relativeRows([row({ carId: 1, lapDist: 700 })], { carId: 99, lapDist: 1 }, L))
      .toEqual([]);
  });

  it("referans tur yoksa sıra kurulur ama saniye null kalır", () => {
    const noPace = { carId: 5, lapDist: 500 };
    const out = relativeRows([row(noPace), row({ carId: 2, lapDist: 600 })], noPace, L, 1, 1);
    expect(out.map((x) => x.r.c.carId)).toEqual([2, 5]);
    expect(out.find((x) => x.r.c.carId === 2).relSec).toBe(null);
  });
});
