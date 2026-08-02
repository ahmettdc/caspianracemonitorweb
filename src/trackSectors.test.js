import { describe, it, expect } from "vitest";
import { observeSector, sectorFractions, sectorRanges,
  packSectors, unpackSectors, emptySectors }
  from "./trackSectors.js";

describe("observeSector — sınır gözlemi", () => {
  it("1→2 geçişini b12'ye, 2→0 geçişini b20'ye yazar", () => {
    let st = emptySectors();
    st = observeSector(st, 1, 2, 0.34);
    st = observeSector(st, 2, 0, 0.72);
    expect(st.b12).toEqual({ sum: 0.34, n: 1 });
    expect(st.b20).toEqual({ sum: 0.72, n: 1 });
  });
  it("0→1 (S/F) ve diğer geçişler SAYILMAZ", () => {
    let st = emptySectors();
    st = observeSector(st, 0, 1, 0.001);   // S/F
    st = observeSector(st, 1, 1, 0.2);     // değişim yok
    st = observeSector(st, 2, 1, 0.5);     // geri sarma (anormal)
    expect(st.b12.n).toBe(0);
    expect(st.b20.n).toBe(0);
  });
  it("birden çok gözlem ortalanır", () => {
    let st = emptySectors();
    st = observeSector(st, 1, 2, 0.30);
    st = observeSector(st, 1, 2, 0.34);
    expect(sectorFractions(st).f12).toBeCloseTo(0.32, 5);
  });
  it("makul olmayan frac yok sayılır", () => {
    let st = emptySectors();
    st = observeSector(st, 1, 2, 1.5);
    st = observeSector(st, 1, 2, -0.1);
    st = observeSector(st, 1, 2, NaN);
    expect(st.b12.n).toBe(0);
  });
});

describe("sectorFractions", () => {
  it("gözlem yoksa null; kısmi gözlemde diğer alan null", () => {
    expect(sectorFractions(emptySectors())).toBeNull();
    expect(sectorFractions(null)).toBeNull();
    let st = observeSector(emptySectors(), 1, 2, 0.4);
    expect(sectorFractions(st)).toEqual({ f12: 0.4, f20: null });
  });
});

describe("sectorRanges — sarı sektör yayı için lapDist aralıkları (v1.4.95)", () => {
  it("üç sektörü sınır kesirlerinden türetir (S1=[0,f12), S2=[f12,f20), S3=[f20,1))", () => {
    expect(sectorRanges({ f12: 0.33, f20: 0.72 })).toEqual([
      { sec: 1, from: 0, to: 0.33 },
      { sec: 2, from: 0.33, to: 0.72 },
      { sec: 3, from: 0.72, to: 1 },
    ]);
  });
  it("iki sınır da gözlenmemişse null (yay çizilemez)", () => {
    expect(sectorRanges(null)).toBeNull();
    expect(sectorRanges({ f12: 0.4, f20: null })).toBeNull();
    expect(sectorRanges({ f12: null, f20: 0.7 })).toBeNull();
  });
});

describe("packSectors / unpackSectors — paylaşım", () => {
  it("round-trip", () => {
    expect(unpackSectors(packSectors({ f12: 0.3312, f20: 0.7231 })))
      .toEqual({ f12: 0.3312, f20: 0.7231 });
  });
  it("kısmi (yalnız f12)", () => {
    const s = packSectors({ f12: 0.4, f20: null });
    expect(s).toBe("0.4000,");
    expect(unpackSectors(s)).toEqual({ f12: 0.4, f20: null });
  });
  it("boş/bozuk → null / \"\"", () => {
    expect(packSectors(null)).toBe("");
    expect(packSectors({ f12: null, f20: null })).toBe("");
    expect(unpackSectors("")).toBeNull();
    expect(unpackSectors("abc")).toBeNull();
    expect(unpackSectors("2,3")).toBeNull();       // 0..1 dışı
  });
});
