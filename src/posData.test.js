import { describe, it, expect } from "vitest";
import { buildPosData, teamColors } from "./posData.js";

/* livepos: { lapKey: { turNo: pozisyon } } — pit turu NEGATİF kodlu. */
const META = { c1: { driver: "A" }, c2: { driver: "B" } };

describe("buildPosData", () => {
  it("tur-tur satır kurar, pozisyonu mutlak alır, turları sıralar", () => {
    const { data, maxPos } = buildPosData(
      { c1: { 2: 1, 1: 3 }, c2: { 1: 5, 2: 4 } }, META);
    expect(data.map((d) => d.lap)).toEqual([1, 2]);
    expect(data[0]).toEqual({ lap: 1, c1: 3, c2: 5 });
    expect(data[1]).toEqual({ lap: 2, c1: 1, c2: 4 });
    expect(maxPos).toBe(5);
  });

  it("negatif değer = pit turu → pitSet'e girer, pozisyon pozitife döner", () => {
    const { data, pitSet } = buildPosData({ c1: { 4: -7 } }, META);
    expect(data[0].c1).toBe(7);
    expect(pitSet.has("c1|4")).toBe(true);
    expect(pitSet.has("c1|3")).toBe(false);
  });

  it("bayat anahtarlar elenir (sahada olmayan araç çizilmez)", () => {
    const pm = { c1: { 1: 1 }, A__Demircan: { 1: 2 }, cX: { 1: 3 } };
    const { keys, data } = buildPosData(pm, META);
    expect(keys).toEqual(["c1"]);                  // yalnız tanınan araç
    expect(data[0]).toEqual({ lap: 1, c1: 1 });    // bayat veri satıra girmez
  });

  it("meta boşsa (köprü durmuş) hiçbir şey gizlenmez", () => {
    const pm = { c1: { 1: 1 }, A__Demircan: { 1: 2 } };
    expect(buildPosData(pm, {}).keys.sort()).toEqual(["A__Demircan", "c1"]);
    expect(buildPosData(pm, null).keys.sort()).toEqual(["A__Demircan", "c1"]);
  });

  it("geçersiz kayıtlar (tur 0 / pozisyon 0) atlanır", () => {
    const { data } = buildPosData({ c1: { 0: 3, 1: 0, 2: 4 } }, META);
    expect(data).toEqual([{ lap: 2, c1: 4 }]);
  });

  it("veri yoksa boş sonuç", () => {
    const empty = buildPosData(null, META);
    expect(empty.data).toEqual([]);
    expect(empty.keys).toEqual([]);
    expect(empty.maxPos).toBe(0);
  });

  it("lastLap: her aracın son değer taşıyan turu", () => {
    const { lastLap } = buildPosData({ c1: { 1: 3, 5: 2 }, c2: { 1: 5, 3: 4 } }, META);
    expect(lastLap).toEqual({ c1: 5, c2: 3 });
  });

  it("rerank: her tur için görünen araçlar sınıf-içi 1..N (genel pozisyon değil)", () => {
    // genel pozisyonlar 8/12/19 → sınıf-içi 1/2/3
    const meta3 = { c1: {}, c2: {}, c3: {} };
    const { data, maxPos } = buildPosData(
      { c1: { 1: 12, 2: 8 }, c2: { 1: 8, 2: 12 }, c3: { 1: 19, 2: 19 } },
      meta3, { rerank: true });
    expect(data[0]).toEqual({ lap: 1, c1: 2, c2: 1, c3: 3 });   // tur1: c2<c1<c3
    expect(data[1]).toEqual({ lap: 2, c1: 1, c2: 2, c3: 3 });   // tur2: c1<c2<c3
    expect(maxPos).toBe(3);                                     // sınıfta 3 araç
  });

  it("rerank pit bayrağını korur (negatif değer sınıf-içi ranka çevrilir)", () => {
    const { data, pitSet } = buildPosData(
      { c1: { 1: -12 }, c2: { 1: 8 } }, META, { rerank: true });
    expect(data[0]).toEqual({ lap: 1, c1: 2, c2: 1 });          // 12>8 → c1 sınıf 2.
    expect(pitSet.has("c1|1")).toBe(true);                     // pit yine işaretli
  });
});

describe("teamColors", () => {
  const PAL = ["#a", "#b", "#c", "#d", "#e", "#f", "#g"];
  it("aynı takımın araçları aynı renk; renk paletten gelir", () => {
    const m = teamColors([
      { lapKey: "c1", team: "Iron Lynx" },
      { lapKey: "c2", team: "WRT" },
      { lapKey: "c3", team: "Iron Lynx" },               // c1 ile aynı takım
    ], PAL);
    expect(m.c1).toBe(m.c3);                              // aynı takım = aynı renk
    expect(PAL).toContain(m.c1);
    expect(PAL).toContain(m.c2);
  });

  it("stabilite: entiteye bağlı → araç çıkınca kalanların rengi DEĞİŞMEZ", () => {
    const full = [
      { lapKey: "c1", team: "AAA" },
      { lapKey: "c2", team: "BBB" },
      { lapKey: "c3", team: "CCC" },
    ];
    const before = teamColors(full, PAL);
    const after = teamColors(full.filter((c) => c.lapKey !== "c2"), PAL);
    expect(after.c1).toBe(before.c1);
    expect(after.c3).toBe(before.c3);                     // hayatta kalan yeniden boyanmaz
    expect("c2" in after).toBe(false);
  });

  it("determinist: aynı girdi aynı çıktı", () => {
    const cars = [{ lapKey: "c1", team: "Vista AF Corsa" }];
    expect(teamColors(cars, PAL)).toEqual(teamColors(cars, PAL));
  });

  it("team yoksa lapKey yedeğiyle renklenir; boş/geçersiz güvenli", () => {
    const m = teamColors([
      { lapKey: "g1", team: "" },                         // takım yok → lapKey
      { lapKey: "g2", team: "WRT" },
      { team: "no-key" },                                 // lapKey yok → atlanır
    ], PAL);
    expect(PAL).toContain(m.g1);
    expect(PAL).toContain(m.g2);
    expect(teamColors(null, PAL)).toEqual({});
    expect(teamColors([{ lapKey: "x", team: "Y" }], null).x).toBeDefined();
  });
});
