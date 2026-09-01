import { describe, it, expect } from "vitest";
import { parseWear, wearSeries, cornerSegments, cornerRate, wearRates,
  lapsLeft, limitingCorner, RESET_EPS } from "./lapWear";

describe("parseWear", () => {
  it("dört köşeyi ayrıştırır", () => {
    expect(parseWear("0.98,0.97,0.99,0.96")).toEqual([0.98, 0.97, 0.99, 0.96]);
  });
  it("0.0 GEÇERLİ diştir (bitmiş lastik) — truthiness ile elenmez", () => {
    expect(parseWear("0,0.5,1,0.25")).toEqual([0, 0.5, 1, 0.25]);
  });
  it("eksik/fazla alan, aralık dışı ve çöp → null", () => {
    expect(parseWear("0.9,0.9,0.9")).toBeNull();
    expect(parseWear("0.9,0.9,0.9,0.9,0.9")).toBeNull();
    expect(parseWear("0.9,0.9,0.9,1.4")).toBeNull();
    expect(parseWear("0.9,0.9,0.9,-0.1")).toBeNull();
    expect(parseWear("a,b,c,d")).toBeNull();
    expect(parseWear("")).toBeNull();
    expect(parseWear(null)).toBeNull();
  });
});

describe("wearSeries", () => {
  it("tur sırasına dizer", () => {
    const s = wearSeries({ 3: "0.9,0.9,0.9,0.9", 1: "1,1,1,1" });
    expect(s.map((x) => x.lap)).toEqual([1, 3]);
  });
  it("bozuk kayıt / geçersiz tur atlanır", () => {
    expect(wearSeries({ 0: "1,1,1,1", "-2": "1,1,1,1", abc: "1,1,1,1", 4: "çöp" }))
      .toEqual([]);
  });
  it("boş girdide çökmez", () => {
    expect(wearSeries(null)).toEqual([]);
    expect(wearSeries("metin")).toEqual([]);
  });
});

/* Senaryo: 6. turda YALNIZ ÖN iki lastik değişti (diş arttı), arka devam etti.
   Tasarımın çekirdeği: sınır pit kaydından değil, VERİDEN okunur → 2-lastik
   değişiminde hangi köşenin sıfırlandığı doğru çözülür. */
const PARTIAL = {
  1: "1.00,1.00,1.00,1.00",
  2: "0.98,0.98,0.99,0.99",
  3: "0.96,0.96,0.98,0.98",
  4: "0.94,0.94,0.97,0.97",
  5: "0.92,0.92,0.96,0.96",
  6: "1.00,1.00,0.95,0.95",
  7: "0.98,0.98,0.94,0.94",
  8: "0.96,0.96,0.93,0.93",
};

describe("cornerSegments", () => {
  it("diş ARTIŞI yeni dönem açar — yalnız değişen köşede", () => {
    const s = wearSeries(PARTIAL);
    expect(cornerSegments(s, 0)).toHaveLength(2);   // fl değişti
    expect(cornerSegments(s, 1)).toHaveLength(2);   // fr değişti
    expect(cornerSegments(s, 2)).toHaveLength(1);   // rl sürüyor
    expect(cornerSegments(s, 3)).toHaveLength(1);   // rr sürüyor
  });
  it("gürültü (RESET_EPS altı artış) dönem açmaz", () => {
    const s = wearSeries({ 1: "1,1,1,1", 2: "0.97,1,1,1", 3: `${0.97 + RESET_EPS / 2},1,1,1` });
    expect(cornerSegments(s, 0)).toHaveLength(1);
  });
});

describe("cornerRate", () => {
  it("değişimden SONRAKİ dönemden hız verir (eski lastik karışmaz)", () => {
    const s = wearSeries(PARTIAL);
    const fl = cornerRate(s, 0);
    expect(fl.fromLap).toBe(6);
    expect(fl.perLap).toBeCloseTo(0.02, 6);   // (1.00−0.96)/2
    expect(fl.tread).toBeCloseTo(0.96, 6);
  });
  it("değişmemiş köşede tüm dönem kullanılır", () => {
    const rl = cornerRate(wearSeries(PARTIAL), 2);
    expect(rl.fromLap).toBe(1);
    expect(rl.perLap).toBeCloseTo(0.01, 6);   // (1.00−0.93)/7
  });
  it("hız TUR NUMARASINDAN hesaplanır — seride boşluk bozmaz", () => {
    const r = cornerRate(wearSeries({ 1: "1,1,1,1", 5: "0.92,1,1,1" }), 0);
    expect(r.perLap).toBeCloseTo(0.02, 6);    // (1−0.92)/4, örnek sayısı değil
  });
  it("son pencere degradasyonun HIZLANDIĞINI gösterir", () => {
    const log = { 1: "1.00,1,1,1", 2: "0.99,1,1,1", 3: "0.98,1,1,1", 4: "0.97,1,1,1",
      5: "0.96,1,1,1", 6: "0.95,1,1,1", 7: "0.92,1,1,1", 8: "0.89,1,1,1",
      9: "0.86,1,1,1", 10: "0.83,1,1,1", 11: "0.80,1,1,1" };
    const r = cornerRate(wearSeries(log), 0);
    expect(r.perLap).toBeCloseTo(0.02, 6);    // dönem ortalaması
    expect(r.recent).toBeCloseTo(0.03, 6);    // son 5 tur — daha hızlı
  });
  it("tek örnek / aşınma yok / hiç veri → null (uydurma yok)", () => {
    expect(cornerRate(wearSeries({ 4: "1,1,1,1" }), 0)).toBeNull();
    expect(cornerRate(wearSeries({ 1: "0.9,1,1,1", 2: "0.9,1,1,1" }), 0)).toBeNull();
    expect(cornerRate([], 0)).toBeNull();
  });
  it("yeni takılmış lastikte (tek örnek) hız üretilmez", () => {
    const r = cornerRate(wearSeries({ 1: "1,1,1,1", 2: "0.98,1,1,1", 3: "1.00,1,1,1" }), 0);
    expect(r).toBeNull();                     // 3. turda değişti → dönemde tek nokta
  });
});

describe("wearRates", () => {
  it("dört köşeyi sırayla döndürür, verisi olmayan köşe perLap=null", () => {
    const rows = wearRates(wearSeries(PARTIAL));
    expect(rows.map((r) => r.corner)).toEqual(["fl", "fr", "rl", "rr"]);
    expect(rows[0].perLap).toBeCloseTo(0.02, 6);
    expect(wearRates([])[0].perLap).toBeNull();
  });
});

describe("lapsLeft", () => {
  it("kalan turu hesaplar", () => {
    expect(lapsLeft(0.5, 0.02)).toBeCloseTo(25, 6);
  });
  it("alt diş sınırı (floor) düşülür", () => {
    expect(lapsLeft(0.5, 0.02, 0.1)).toBeCloseTo(20, 6);
  });
  it("sınırın altındaysa 0, hız yoksa null", () => {
    expect(lapsLeft(0.05, 0.02, 0.1)).toBe(0);
    expect(lapsLeft(0.5, null)).toBeNull();
    expect(lapsLeft(0.5, 0)).toBeNull();
    expect(lapsLeft(null, 0.02)).toBeNull();
  });
});

describe("limitingCorner", () => {
  it("pit penceresini belirleyen (en az turu kalan) köşeyi seçer", () => {
    /* rl hızlı aşınıyor: dişi düşük VE hızı yüksek → kalan tur en az. */
    const log = { 1: "1.00,1.00,1.00,1.00", 2: "0.99,0.99,0.94,0.99",
      3: "0.98,0.98,0.88,0.98", 4: "0.97,0.97,0.82,0.97" };
    const lim = limitingCorner(wearSeries(log));
    expect(lim.corner).toBe("rl");
    expect(lim.left).toBeCloseTo(0.82 / 0.06, 4);
  });
  it("veri yoksa null", () => {
    expect(limitingCorner([])).toBeNull();
  });
});
