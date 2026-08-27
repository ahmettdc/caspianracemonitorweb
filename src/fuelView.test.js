import { describe, it, expect } from "vitest";
import { classHasVE, fuelView } from "./constants";

describe("classHasVE — Virtual Energy yalnız Hypercar ve GT3", () => {
  it("VE sınıfları true döner (iç id ve ham metin)", () => {
    expect(classHasVE("hypercar")).toBe(true);
    expect(classHasVE("gt3")).toBe(true);
    expect(classHasVE("LMGT3")).toBe(true);       // classId → gt3
    expect(classHasVE("Hypercar")).toBe(true);
  });
  it("VE olmayan sınıflar false döner", () => {
    expect(classHasVE("lmp2")).toBe(false);
    expect(classHasVE("lmp3")).toBe(false);
    expect(classHasVE("gte")).toBe(false);
    expect(classHasVE("LMP2")).toBe(false);
  });
  it("sınıf seçilmemişse (kurulum) VE varsayılır", () => {
    expect(classHasVE("")).toBe(true);
    expect(classHasVE(undefined)).toBe(true);
  });
});

describe("fuelView — sunum katmanı (dahili birim değişmez)", () => {
  const st = (carClass) => ({ carClass, consumption: 10, fuelRatio: 0.8 });

  it("VE sınıfı: yüzde biçimi, litre türevleri doğru", () => {
    const fv = fuelView(st("gt3"));
    expect(fv.hasVE).toBe(true);
    expect(fv.perLapL).toBeCloseTo(8);      // 10% × 0.8 L/%
    expect(fv.tankL).toBeCloseTo(80);       // 100% × 0.8
    expect(fv.toL(50)).toBeCloseTo(40);
    expect(fv.fmt(12.3)).toBe("12.3%");
  });

  it("VE olmayan sınıf: litre biçimi", () => {
    const fv = fuelView(st("lmp2"));
    expect(fv.hasVE).toBe(false);
    expect(fv.perLapL).toBeCloseTo(8);      // mutlak litre temsilden bağımsız
    expect(fv.tankL).toBeCloseTo(80);
    expect(fv.fmt(50)).toBe("40.0 L");      // 50% × 0.8 = 40 L
    expect(fv.fmt(50, 2)).toBe("40.00 L");
  });

  it("eksik/0 değerlerde çökmez", () => {
    const fv = fuelView({ carClass: "gte" });
    expect(fv.ratio).toBe(0);
    expect(fv.perLapL).toBe(0);
    expect(fv.tankL).toBe(0);
    expect(fv.fmt(10)).toBe("0.0 L");
  });
});
