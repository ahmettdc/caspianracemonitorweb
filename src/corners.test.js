import { describe, it, expect } from "vitest";
import { detectApexes, cornerStats } from "./corners";

/* Sentetik profil: 10m aralık; iki viraj (index 20 → ~100 km/h, index 60 → ~120 km/h),
   aralarda 200 km/h düzlük. Her apex'ten önce ~8 örnek (80m) fren. */
function build() {
  const N = 90;
  const d = Array.from({ length: N }, (_, i) => i * 10);      // metre
  const spA = Array.from({ length: N }, (_, i) => {
    const c1 = 100 + Math.abs(i - 20) * 8;                    // apex 20
    const c2 = 120 + Math.abs(i - 60) * 8;                    // apex 60
    return Math.min(200, c1, c2);
  });
  const spB = spA.map((v, i) => (i >= 55 && i <= 65 ? v + 10 : v)); // B viraj2'de biraz hızlı
  const brA = Array.from({ length: N }, (_, i) =>
    ((i >= 12 && i < 20) || (i >= 52 && i < 60) ? 60 : 0));
  const brB = brA.map((v, i) => (i >= 54 && i < 60 ? 60 : (i >= 52 && i < 54 ? 0 : v))); // B daha geç frenler
  return { N, d, spA, spB, brA, brB };
}
function toData(b) {
  return b.d.map((d, i) => ({ d, spA: b.spA[i], spB: b.spB[i], brA: b.brA[i], brB: b.brB[i] }));
}

describe("detectApexes", () => {
  it("iki virajı bulur (apex index'leri)", () => {
    const b = build();
    const ap = detectApexes(b.spA, b.d);
    expect(ap).toEqual([20, 60]);
  });
  it("belirginlik süzgeci: sığ dalga viraj sayılmaz", () => {
    const N = 40;
    const d = Array.from({ length: N }, (_, i) => i * 10);
    const sp = Array.from({ length: N }, (_, i) => 200 - Math.abs(i - 20) * 1); // sadece 20 km/h dip
    expect(detectApexes(sp, d, { minDropKmh: 30 })).toEqual([]);
  });
  it("kısa/boş → []", () => {
    expect(detectApexes([], [])).toEqual([]);
    expect(detectApexes([1, 2], [0, 10])).toEqual([]);
  });
  it("null örnekler apex sayılmaz", () => {
    const d = Array.from({ length: 20 }, (_, i) => i * 10);
    const sp = Array.from({ length: 20 }, (_, i) => (i === 10 ? null : 200));
    expect(detectApexes(sp, d)).toEqual([]);
  });
});

describe("cornerStats", () => {
  it("apex hızları + fren mesafeleri", () => {
    const b = build();
    const data = toData(b);
    const ap = detectApexes(b.spA, b.d);
    const cs = cornerStats(data, ap);
    expect(cs).toHaveLength(2);
    expect(cs[0].no).toBe(1);
    expect(cs[0].apexD).toBe(200);          // index 20 × 10m
    expect(cs[0].aMin).toBe(100);           // viraj 1 apex hızı
    expect(cs[1].aMin).toBe(120);
    // A viraj1'de index 12'den frenler → apex(20) − 12 = 8 örnek × 10m = 80m
    expect(cs[0].aBrakeDist).toBe(80);
    // B viraj2'de daha geç (index 54) → apex(60) − 54 = 6 × 10 = 60m; A = index52 → 80m
    expect(cs[1].aBrakeDist).toBe(80);
    expect(cs[1].bBrakeDist).toBe(60);
  });
  it("fren kanalı yoksa fren mesafesi null", () => {
    const b = build();
    const data = b.d.map((d, i) => ({ d, spA: b.spA[i], spB: b.spB[i], brA: null, brB: null }));
    const cs = cornerStats(data, detectApexes(b.spA, b.d));
    expect(cs[0].aBrakeDist).toBeNull();
    expect(cs[0].bBrakeDist).toBeNull();
    expect(cs[0].aMin).toBe(100);           // hız yine hesaplanır
  });
  it("apex yoksa → []", () => {
    expect(cornerStats(toData(build()), [])).toEqual([]);
  });
});
