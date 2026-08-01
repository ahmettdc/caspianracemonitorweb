import { describe, it, expect } from "vitest";
import { compoundClass, compoundInfo, compoundAxles, parseTyreLog, COMPOUNDS }
  from "./tyreCompound.js";

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

describe("compoundInfo — tek hamur UI bilgisi", () => {
  it("bilinen kademe: ikon/harf/renk alanları", () => {
    const m = compoundInfo("Medium");
    expect(m.cls).toBe("medium");
    expect(m.short).toBe("M");
    expect(m.label).toBe("Medium");
    expect(m.color).toBe(COMPOUNDS.medium.color);
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

describe("compoundAxles — ön/arka ayrımı (crossover)", () => {
  it("tek hamur → front dolu, rear yok, split false", () => {
    const a = compoundAxles("Medium");
    expect(a.front.cls).toBe("medium");
    expect(a.rear).toBeNull();
    expect(a.split).toBe(false);
  });
  it("ön≠arka → iki kademe, split true (köprü sırası ön/arka)", () => {
    const a = compoundAxles("Medium/Soft");
    expect(a.front.cls).toBe("medium");
    expect(a.rear.cls).toBe("soft");
    expect(a.split).toBe(true);
  });
  it("ön=arka aynı ad → split false (tek ikon)", () => {
    const a = compoundAxles("Medium/Medium");
    expect(a.front.cls).toBe("medium");
    expect(a.rear).toBeNull();
    expect(a.split).toBe(false);
  });
  it("virgül ayraç ve boşluk toleransı", () => {
    const a = compoundAxles("Wet , Medium");
    expect(a.front.cls).toBe("wet");
    expect(a.rear.cls).toBe("medium");
    expect(a.split).toBe(true);
  });
  it("bilinmeyen + bilinen karışımı yine ayrılır", () => {
    const a = compoundAxles("Slick X17/Soft");
    expect(a.front.cls).toBeNull();
    expect(a.front.short).toBe("Sli");
    expect(a.rear.cls).toBe("soft");
    expect(a.split).toBe(true);
  });
  it("veri yoksa null", () => {
    expect(compoundAxles("")).toBeNull();
    expect(compoundAxles(null)).toBeNull();
  });
});

describe("parseTyreLog — pit lastik değişimi kaydı", () => {
  it("adet + hamur ayrıştırılır", () => {
    expect(parseTyreLog("4|Medium")).toEqual({ n: 4, comp: "Medium" });
    expect(parseTyreLog("2|Medium/Soft")).toEqual({ n: 2, comp: "Medium/Soft" });
    expect(parseTyreLog("0|")).toEqual({ n: 0, comp: null });   // yakıt-only
  });
  it("bozuk/eksik → null", () => {
    expect(parseTyreLog("")).toBeNull();
    expect(parseTyreLog(null)).toBeNull();
    expect(parseTyreLog("Medium")).toBeNull();      // ayraç yok
    expect(parseTyreLog("x|Medium")).toBeNull();    // adet sayı değil
    expect(parseTyreLog("9|Medium")).toBeNull();    // 0..4 dışı
  });
});
