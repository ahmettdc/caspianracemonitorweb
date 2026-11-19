import { describe, it, expect } from "vitest";
import { resolveScen, setScen, scenDefault } from "./fuelScen";

describe("yakıt senaryoları (v2.5.3 — kalıcı girdi)", () => {
  it("kayıt yokken tüketimden türetilir (v2.0 oranları)", () => {
    expect(resolveScen(4, null)).toEqual({ plan: 4, save: 3.8, push: 4.32 });
    expect(resolveScen(4, undefined)).toEqual(resolveScen(4, {}));
  });

  it("KULLANICI HATASI: yazılan girdi state'te kalır, yeniden okunduğunda aynı döner", () => {
    const saved = setScen(3.87, null, "save", 3.6);
    /* sekme değişti → bileşen yeniden kuruldu → yalnız st.fuelScen'den okunur */
    expect(resolveScen(3.87, saved)).toEqual({ plan: 3.87, save: 3.6, push: scenDefault("push", 3.87) });
  });

  it("birden çok girdi birlikte korunur", () => {
    let s = setScen(3.87, null, "save", 3.6);
    s = setScen(3.87, s, "push", 4.5);
    expect(resolveScen(3.87, s)).toMatchObject({ save: 3.6, push: 4.5 });
  });

  it("tüketim değişince girdi bayatlar → varsayılana döner (eski useEffect davranışı)", () => {
    const s = setScen(3.87, null, "save", 3.6);
    expect(resolveScen(4.1, s)).toEqual(resolveScen(4.1, null));
  });

  it("bayat kayıt üstüne yazınca eski girdiler geri DÖNMEZ", () => {
    const old = setScen(3.87, null, "save", 3.6);
    const s = setScen(4.1, old, "push", 4.6);
    expect(resolveScen(4.1, s)).toEqual({ plan: 4.1, save: scenDefault("save", 4.1), push: 4.6 });
  });

  it("geçersiz girdi yok sayılır (negatif, NaN, bilinmeyen senaryo)", () => {
    const s = setScen(3.87, null, "save", 3.6);
    expect(setScen(3.87, s, "save", -1)).toBe(s);
    expect(setScen(3.87, s, "save", NaN)).toBe(s);
    expect(setScen(3.87, s, "x", 2)).toBe(s);
    expect(resolveScen(3.87, { base: 3.87, save: "abc", push: null })).toEqual(resolveScen(3.87, null));
  });

  it("0 geçerli bir girdi (Number(null) === 0 tuzağına düşmeden)", () => {
    expect(resolveScen(3.87, setScen(3.87, null, "save", 0)).save).toBe(0);
    expect(resolveScen(3.87, { base: 3.87, save: null }).save).toBe(scenDefault("save", 3.87));
  });
});
