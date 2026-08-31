import { describe, it, expect } from "vitest";
import { fold, matchQuery, sortRows, SORT_VALUE, SORT_DEFAULT_DIR } from "./liveSort";

/* LiveTab'ın türetilmiş satır şekli: { c, i, interval, ... } */
const row = (c, extra = {}) => ({ c: { pos: 1, ...c }, ...extra });

describe("fold", () => {
  it("Türkçe/aksanlı harfleri ASCII'ye katlar", () => {
    expect(fold("Şahin")).toBe("sahin");
    expect(fold("İnci")).toBe("inci");
    expect(fold("Ilgaz")).toBe("ilgaz");
    expect(fold("Portimão")).toBe("portimao");
    expect(fold("  Ağrı  ")).toBe("agri");
  });
  it("boş/None girdide çökmez", () => {
    expect(fold(null)).toBe("");
    expect(fold(undefined)).toBe("");
  });
});

describe("matchQuery", () => {
  const c = { driver: "Ahmet Şahin", team: "Caspian Racing", number: "92",
    vehicleName: "Porsche 963", carClass: "Hypercar" };
  it("boş sorgu her satırı geçirir", () => {
    expect(matchQuery(c, "")).toBe(true);
    expect(matchQuery(c, "   ")).toBe(true);
  });
  it("pilot, takım, no, araç ve sınıf üzerinden bulur", () => {
    expect(matchQuery(c, "ahmet")).toBe(true);
    expect(matchQuery(c, "caspian")).toBe(true);
    expect(matchQuery(c, "92")).toBe(true);
    expect(matchQuery(c, "#92")).toBe(true);
    expect(matchQuery(c, "963")).toBe(true);
    expect(matchQuery(c, "hyper")).toBe(true);
  });
  it("aksansız yazınca da bulur (katlama iki yönde çalışır)", () => {
    expect(matchQuery(c, "sahin")).toBe(true);
    expect(matchQuery(c, "ŞAHİN")).toBe(true);
  });
  it("eşleşmeyeni eler; bozuk satırda çökmez", () => {
    expect(matchQuery(c, "verstappen")).toBe(false);
    expect(matchQuery(null, "x")).toBe(false);
    expect(matchQuery(null, "")).toBe(true);
  });
});

describe("sortRows", () => {
  const rows = [
    row({ pos: 1, driver: "A", damage: 0.01, lapsDone: 10, pitStops: 2 }),
    row({ pos: 2, driver: "B", damage: 0.30, lapsDone: 12, pitStops: 1 }),
    row({ pos: 3, driver: "C", damage: 0.10, lapsDone: 11, pitStops: 3 }),
  ];
  const pos = (out) => out.map((r) => r.c.pos);

  it("bilinmeyen/boş anahtarda listeye dokunmaz", () => {
    expect(sortRows(rows, null, "asc")).toBe(rows);
    expect(sortRows(rows, "yok", "asc")).toBe(rows);
  });

  it("sayısal sütunu iki yönde sıralar", () => {
    expect(pos(sortRows(rows, "dmg", "desc"))).toEqual([2, 3, 1]);
    expect(pos(sortRows(rows, "dmg", "asc"))).toEqual([1, 3, 2]);
    expect(pos(sortRows(rows, "laps", "desc"))).toEqual([2, 3, 1]);
  });

  it("EKSİK değerli satırlar YÖNDEN BAĞIMSIZ sona gider", () => {
    const withGaps = [
      row({ pos: 1, damage: null }),
      row({ pos: 2, damage: 0.3 }),
      row({ pos: 3, damage: 0.1 }),
    ];
    expect(pos(sortRows(withGaps, "dmg", "desc"))).toEqual([2, 3, 1]);
    expect(pos(sortRows(withGaps, "dmg", "asc"))).toEqual([3, 2, 1]);
  });

  it("Infinity/NaN de 'eksik' sayılır (sona gider)", () => {
    const odd = [
      row({ pos: 1, stintSec: 100 }),
      row({ pos: 2, stintSec: Number.NaN }),
      row({ pos: 3, stintSec: 300 }),
    ];
    expect(pos(sortRows(odd, "stint", "desc"))).toEqual([3, 1, 2]);
  });

  it("eşit değerlerde YARIŞ POZİSYONU çözer (satır zıplaması olmaz)", () => {
    const tied = [
      row({ pos: 3, penaltiesTotal: 0 }),
      row({ pos: 1, penaltiesTotal: 0 }),
      row({ pos: 2, penaltiesTotal: 0 }),
    ];
    expect(pos(sortRows(tied, "pen", "desc"))).toEqual([1, 2, 3]);
    expect(pos(sortRows(tied, "pen", "asc"))).toEqual([1, 2, 3]);
  });

  it("pilot adını Türkçe sıralar; takım modunda takıma göre sıralar", () => {
    const names = [
      row({ pos: 1, driver: "Zeki", team: "Alfa" }),
      row({ pos: 2, driver: "Ahmet", team: "Zeta" }),
    ];
    expect(pos(sortRows(names, "driver", "asc"))).toEqual([2, 1]);
    expect(pos(sortRows(names, "driver", "asc", { showTeam: true }))).toEqual([1, 2]);
  });

  it("takaslı sütunlar EKRANDA GÖRÜNEN değere göre sıralanır", () => {
    const laps = [
      row({ pos: 1, lastSec: 100, bestSec: 99 }),
      row({ pos: 2, lastSec: 98, bestSec: 97 }),
    ];
    expect(pos(sortRows(laps, "lap", "asc", { lapMode: false }))).toEqual([2, 1]);
    expect(pos(sortRows(laps, "lap", "asc", { lapMode: true }))).toEqual([2, 1]);
    // Gap sütunu: gapMode'da satırın `interval` alanı okunur
    const gaps = [row({ pos: 1, gapSec: 0 }, { interval: 5 }),
      row({ pos: 2, gapSec: 9 }, { interval: 1 })];
    expect(pos(sortRows(gaps, "gap", "asc", { gapMode: false }))).toEqual([1, 2]);
    expect(pos(sortRows(gaps, "gap", "asc", { gapMode: true }))).toEqual([2, 1]);
  });

  it("Lastik sütunu EN KÖTÜ köşeye göre sıralar (tyreWear yoksa tyres4'ten)", () => {
    expect(SORT_VALUE.tyre(row({ tyreWear: 0.5 }))).toBe(0.5);
    expect(SORT_VALUE.tyre(row({ tyres4: [0.9, 0.8, 0.7, 0.95] }))).toBe(0.7);
    expect(SORT_VALUE.tyre(row({}))).toBe(null);
  });

  it("her sütunun doğal ilk yönü tanımlı", () => {
    for (const k of Object.keys(SORT_VALUE)) {
      expect(SORT_DEFAULT_DIR[k], `${k} için varsayılan yön yok`).toBeTruthy();
    }
  });

  it("değer çıkarıcı patlarsa satır 'eksik' sayılır, sıralama çökmez", () => {
    const boom = [row({ pos: 1 }), { c: null }];
    expect(() => sortRows(boom, "dmg", "asc")).not.toThrow();
  });
});
