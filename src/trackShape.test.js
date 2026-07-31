import { describe, it, expect } from "vitest";
import { binKey, packBins, unpackBins } from "./trackShape.js";

describe("binKey", () => {
  it("pist adından Firebase-güvenli anahtar (yasak karakterler → _)", () => {
    expect(binKey("Spa-Francorchamps", 7004)).toBe("Spa-Francorchamps");
    expect(binKey("Le Mans / Circuit.24h", 13629)).toBe("Le Mans _ Circuit_24h");
    expect(binKey("a#b$c[d]", 0)).toBe("a_b_c_d_");
  });
  it("ad yoksa yuvarlanmış uzunluktan L{n}", () => {
    expect(binKey("", 5891.4)).toBe("L5891");
    expect(binKey(null, 5891.4)).toBe("L5891");
    expect(binKey("   ", 4000)).toBe("L4000");
  });
  it("ad ve uzunluk yoksa boş (paylaşım kapalı)", () => {
    expect(binKey("", 0)).toBe("");
    expect(binKey(null, null)).toBe("");
  });
});

describe("packBins / unpackBins", () => {
  it("round-trip: kutular korunur (1 ondalık), b'ye göre sıralı", () => {
    const bins = { 5: { x: 12.34, z: -5.67 }, 1: { x: 0, z: 100.25 } };
    const packed = packBins(bins);
    expect(packed).toBe("1:0.0,100.3;5:12.3,-5.7");
    const back = unpackBins(packed);
    expect(back[1]).toEqual({ x: 0, z: 100.3 });
    expect(back[5]).toEqual({ x: 12.3, z: -5.7 });
  });
  it("geçersiz koordinatlı kutu atlanır", () => {
    const packed = packBins({ 0: { x: NaN, z: 1 }, 2: { x: 3, z: 4 } });
    expect(packed).toBe("2:3.0,4.0");
  });
  it("bozuk / eksik string → {} veya sağlam parça", () => {
    expect(unpackBins("")).toEqual({});
    expect(unpackBins(null)).toEqual({});
    expect(unpackBins("çöp")).toEqual({});
    expect(unpackBins("3:1,2;bozuk;5:9,9")).toEqual({ 3: { x: 1, z: 2 }, 5: { x: 9, z: 9 } });
  });
  it("boş/null bins → boş string", () => {
    expect(packBins(null)).toBe("");
    expect(packBins({})).toBe("");
  });
  it("240 kutuluk gerçekçi şekil round-trip (boyut sınırı altında)", () => {
    const bins = {};
    for (let i = 0; i < 240; i++) bins[i] = { x: Math.sin(i) * 500, z: Math.cos(i) * 400 };
    const packed = packBins(bins);
    expect(packed.length).toBeLessThan(9000);
    expect(Object.keys(unpackBins(packed)).length).toBe(240);
  });
});
