import { describe, it, expect } from "vitest";
import { lapNumbersOf, driverAtLap, parseLapCond } from "./liveLaps.js";

/* Tur numarası eşlemesi — kalıcı livelaps/livepos/livesec düğümlerine YAZILAN
   anahtarları belirler; hata kalıcı veri bozulması demektir (append-only). */
describe("lapNumbersOf", () => {
  it("köprü lapNums verdiyse GERÇEK numaraları kullanır (boşluklu log)", () => {
    // Aggregator geçersiz turu (lastSec<=0) log'a yazmaz → 3 atlanmış
    const row = { laps: [101.0, 100.5, 102.0, 100.9], lapNums: [1, 2, 4, 5], lapsFrom: 1 };
    expect(lapNumbersOf(row)).toEqual([1, 2, 4, 5]);
  });

  it("lapsDone >1 atladığında da doğru (kare kaçırma)", () => {
    const row = { laps: [90.1, 91.2], lapNums: [7, 10], lapsFrom: 7 };
    expect(lapNumbersOf(row)).toEqual([7, 10]);
  });

  it("eski köprü (lapNums yok) → lapsFrom+i ardışık davranışına düşer", () => {
    const row = { laps: [101.0, 100.5, 102.0], lapsFrom: 5 };
    expect(lapNumbersOf(row)).toEqual([5, 6, 7]);
  });

  it("bozuk lapNums (uzunluk uyuşmuyor / geçersiz) → ardışığa düşer", () => {
    expect(lapNumbersOf({ laps: [1, 2, 3], lapNums: [4, 5], lapsFrom: 4 })).toEqual([4, 5, 6]);
    expect(lapNumbersOf({ laps: [1, 2], lapNums: [0, 3], lapsFrom: 2 })).toEqual([2, 3]);
    expect(lapNumbersOf({ laps: [1, 2], lapNums: ["a", "b"], lapsFrom: 2 })).toEqual([2, 3]);
  });

  it("veri yoksa boş dizi (yazım yapılmaz)", () => {
    expect(lapNumbersOf(null)).toEqual([]);
    expect(lapNumbersOf({})).toEqual([]);
    expect(lapNumbersOf({ laps: [] })).toEqual([]);
    expect(lapNumbersOf({ laps: [90.1] })).toEqual([]);          // lapsFrom yok
    expect(lapNumbersOf({ laps: [90.1], lapsFrom: 0 })).toEqual([]);
  });

  it("regresyon: boşluklu log ARDIŞIK varsayılırsa tur kayar (eski hata)", () => {
    const row = { laps: [101.0, 100.5, 102.0, 100.9], lapNums: [1, 2, 4, 5], lapsFrom: 1 };
    const eski = row.laps.map((_, i) => row.lapsFrom + i);   // eski JS mantığı
    expect(eski).toEqual([1, 2, 3, 4]);                       // tur 4/5 → 3/4 diye yazılırdı
    expect(lapNumbersOf(row)).not.toEqual(eski);              // artık düzeldi
  });
});

/* ---- driverAtLap: tur → pilot (endurance driver swap, SEYREK kayıt) ---- */
describe("driverAtLap", () => {
  // A pilotu tur 1'den, B pilotu tur 31'den, C pilotu tur 60'tan itibaren
  const map = { 1: "A. Demircan", 31: "M. Yılmaz", 60: "E. Kaya" };

  it("değişim turunda ve sonrasında doğru pilot (ileri doldurma)", () => {
    expect(driverAtLap(map, 1)).toBe("A. Demircan");
    expect(driverAtLap(map, 15)).toBe("A. Demircan");
    expect(driverAtLap(map, 31)).toBe("M. Yılmaz");
    expect(driverAtLap(map, 59)).toBe("M. Yılmaz");
    expect(driverAtLap(map, 60)).toBe("E. Kaya");
    expect(driverAtLap(map, 300)).toBe("E. Kaya");
  });

  it("sayısal sıralama: metin sıralamasında '9' > '10' olurdu", () => {
    expect(driverAtLap({ 9: "A", 10: "B" }, 12)).toBe("B");
    expect(driverAtLap({ 2: "A", 100: "B" }, 99)).toBe("A");
  });

  it("ilk kayıttan önceki tur → boş (köprü sonradan açıldı)", () => {
    expect(driverAtLap({ 31: "M. Yılmaz" }, 12)).toBe("");
  });

  it("boş / bozuk map ve geçersiz tur → boş", () => {
    expect(driverAtLap(null, 5)).toBe("");
    expect(driverAtLap({}, 5)).toBe("");
    expect(driverAtLap("çöp", 5)).toBe("");
    expect(driverAtLap(map, 0)).toBe("");
    expect(driverAtLap({ 1: 42, 2: "" }, 5)).toBe("");   // string olmayan/boş atlanır
  });
});

/* ---- parseLapCond: "temp,wet,grip" → {temp, wet, grip} (pist koşulları) ---- */
describe("parseLapCond", () => {
  it("üç alanı sayıya çevirir", () => {
    expect(parseLapCond("31,22,73")).toEqual({ temp: 31, wet: 22, grip: 73 });
    expect(parseLapCond("28,0,50")).toEqual({ temp: 28, wet: 0, grip: 50 });
  });
  it("eksik/boş alan → o alan null", () => {
    expect(parseLapCond("31,,73")).toEqual({ temp: 31, wet: null, grip: 73 });
    expect(parseLapCond(",,60")).toEqual({ temp: null, wet: null, grip: 60 });
  });
  it("hepsi boş/geçersiz veya bozuk girdi → null", () => {
    expect(parseLapCond(",,")).toBeNull();
    expect(parseLapCond("")).toBeNull();
    expect(parseLapCond(null)).toBeNull();
    expect(parseLapCond("abc")).toBeNull();      // temp "abc" → null, diğerleri yok
  });
});
