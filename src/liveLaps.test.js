import { describe, it, expect } from "vitest";
import { lapNumbersOf } from "./liveLaps.js";

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
