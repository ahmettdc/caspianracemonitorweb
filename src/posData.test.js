import { describe, it, expect } from "vitest";
import { buildPosData } from "./posData.js";

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
});
