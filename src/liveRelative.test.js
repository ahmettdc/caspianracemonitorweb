import { describe, it, expect } from "vitest";
import { wrapDist, relGapSec, refLap, relativeRows } from "./liveRelative";

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
