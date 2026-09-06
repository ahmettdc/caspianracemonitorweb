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

/* v2.4.1 — lapWear artık Lastik ekranına BAĞLI (ölü yol değil).
   Köprü her tur `livewear` yazıyordu ama hiçbir ekran okumuyordu: 180 satırlık
   modül + liveWearSubscribe boştaydı, yani oyun PC'sinde ödenen maliyetin
   karşılığı alınmıyordu. TyreTab'ın ölçüm butonu artık BİRİNCİL kaynak olarak
   bunu kullanıyor; eski "anlık diş + açık dönem" hesabı yedeğe düştü.

   Bu blok TyreTab'ın dayandığı sözleşmeyi kilitliyor: kısmi değişim doğru
   çözülmeli ve iki gerçek okuma arasındaki farktan hız çıkmalı — eski yedek
   ikisini de yapamıyordu (4 lastik birden değişmiş olmasını şart koşuyor ve
   stint başında dişin tam 1.00 olduğunu VARSAYIYOR). */
describe("TyreTab ölçüm sözleşmesi — kısmi değişim ve gerçek okuma farkı", () => {
  it("KISMİ değişim (yalnız ön ikili) doğru çözülür", () => {
    /* Tur 1-3 hepsi aşınıyor; tur 4'te ÖN ikili yenileniyor (diş artışı). */
    const log = {
      1: "0.90,0.90,0.90,0.90",
      2: "0.80,0.80,0.86,0.86",
      3: "0.70,0.70,0.82,0.82",
      4: "1.00,1.00,0.78,0.78",
      5: "0.90,0.90,0.74,0.74",
    };
    const series = wearSeries(log);
    const rates = wearRates(series);
    // ön: yeni dönem (tur 4-5) → %10/tur · arka: tek dönem → %4/tur
    expect(rates[0].perLap).toBeCloseTo(0.10, 3);
    expect(rates[1].perLap).toBeCloseTo(0.10, 3);
    expect(rates[2].perLap).toBeCloseTo(0.04, 3);
    expect(rates[3].perLap).toBeCloseTo(0.04, 3);
  });

  it("hız, dişin 1.00'dan başladığı VARSAYIMINA değil gerçek farka dayanır", () => {
    /* Stint ortasında yakalanmış set: ilk okuma 0.62. Eski yedek bunu
       (1 − 0.42) / tur diye okuyup hızı ŞİŞİRİRDİ. */
    const series = wearSeries({ 10: "0.62,0.62,0.62,0.62", 12: "0.52,0.52,0.52,0.52" });
    const r = wearRates(series);
    expect(r[0].perLap).toBeCloseTo(0.05, 3);       // (0.62 − 0.52) / 2 tur
  });

  it("EN KRİTİK köşe ve kalan tur türetilir (pit penceresi)", () => {
    const series = wearSeries({
      1: "0.90,0.90,0.90,0.90",
      5: "0.50,0.70,0.74,0.74",   // FL en hızlı aşınan
    });
    const lim = limitingCorner(series);
    expect(lim).not.toBe(null);
    expect(lim.corner).toBe("fl");
    expect(lim.left).toBeCloseTo(0.5 / 0.1, 3);     // %50 diş / %10 per tur
  });

  it("tek okuma varken ölçüm YOK (uydurma hız üretilmez)", () => {
    expect(wearRates(wearSeries({ 3: "0.90,0.90,0.90,0.90" }))
      .every((r) => r.perLap === null)).toBe(true);
    expect(limitingCorner(wearSeries({}))).toBe(null);
  });
});
