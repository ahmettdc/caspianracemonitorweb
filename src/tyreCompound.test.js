import { describe, it, expect } from "vitest";
import { compoundClass, compoundInfo, COMPOUNDS } from "./tyreCompound.js";

describe("compoundClass — ham ad → kademe", () => {
  it("temel kelimeler (büyük-küçük harf duyarsız)", () => {
    expect(compoundClass("Soft")).toBe("soft");
    expect(compoundClass("MEDIUM")).toBe("medium");
    expect(compoundClass("hard")).toBe("hard");
    expect(compoundClass("Wet")).toBe("wet");
  });
  it("ıslak eşanlamlıları", () => {
    expect(compoundClass("Full Wet")).toBe("wet");
    expect(compoundClass("Intermediate")).toBe("wet");
    expect(compoundClass("Rain")).toBe("wet");
  });
  it("üretici/ekli adların içinden yakalar", () => {
    expect(compoundClass("Michelin Medium")).toBe("medium");
    expect(compoundClass("Hypercar Soft")).toBe("soft");
    expect(compoundClass("GT3 Hard S9")).toBe("hard");
  });
  it("tek-harf kodları yalnız tam eşleşmede", () => {
    expect(compoundClass("M")).toBe("medium");
    expect(compoundClass("w")).toBe("wet");
    expect(compoundClass("X")).toBeNull();      // bilinmeyen harf
  });
  it("ön/arka crossover'da İLK parça sınıflandırılır", () => {
    expect(compoundClass("Medium/Wet")).toBe("medium");
    expect(compoundClass("Wet, Medium")).toBe("wet");
  });
  it("boş/bilinmeyen → null (uydurma yok)", () => {
    expect(compoundClass("")).toBeNull();
    expect(compoundClass(null)).toBeNull();
    expect(compoundClass("Slick X17")).toBeNull();
  });
});

describe("compoundInfo — UI bilgisi", () => {
  it("bilinen kademe: ikon/harf/renk alanları", () => {
    const m = compoundInfo("Medium");
    expect(m.cls).toBe("medium");
    expect(m.short).toBe("M");
    expect(m.label).toBe("Medium");
    expect(m.color).toBe(COMPOUNDS.medium.color);
    expect(m.crossover).toBe(false);
  });
  it("crossover işaretlenir ama ilk kademe döner", () => {
    const c = compoundInfo("Medium/Wet");
    expect(c.cls).toBe("medium");
    expect(c.crossover).toBe(true);
    expect(c.raw).toBe("Medium/Wet");
  });
  it("bilinmeyen ad: cls null, ham kısaltma korunur", () => {
    const u = compoundInfo("Slick X17");
    expect(u.cls).toBeNull();
    expect(u.short).toBe("Sli");
    expect(u.label).toBe("Slick X17");
  });
  it("veri yoksa null", () => {
    expect(compoundInfo("")).toBeNull();
    expect(compoundInfo(null)).toBeNull();
    expect(compoundInfo("   ")).toBeNull();
  });
});
