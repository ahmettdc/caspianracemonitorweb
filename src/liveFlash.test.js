import { describe, it, expect } from "vitest";
import { detectFlashes, carKey } from "./liveFlash";

const car = (o) => ({ carClass: "Hypercar", ...o });

describe("carKey", () => {
  it("lapKey önceliklidir, sonra carId, sonra driver", () => {
    expect(carKey({ lapKey: "c5", carId: 5, driver: "A" })).toBe("c5");
    expect(carKey({ carId: 7, driver: "A" })).toBe("c7");
    expect(carKey({ driver: "Ahmet" })).toBe("Ahmet");
    expect(carKey({})).toBe(null);
    expect(carKey(null)).toBe(null);
  });
});

describe("detectFlashes", () => {
  it("ilk görüşte flash ÜRETMEZ ama bestSec'i kaydeder", () => {
    const { flashes, nextBest } = detectFlashes(
      [car({ lapKey: "c1", bestSec: 100 })], {});
    expect(flashes).toEqual({});
    expect(nextBest.c1).toBe(100);
  });

  it("sınıf en hızlısını atınca MOR yanar", () => {
    const prev = { c1: 100, c2: 98 };
    const { flashes } = detectFlashes(
      [car({ lapKey: "c1", bestSec: 97 }), car({ lapKey: "c2", bestSec: 98 })], prev);
    expect(flashes.c1).toBe("purple");   // 97 < 98 → sınıf rekoru
    expect(flashes.c2).toBeUndefined();  // c2 gelişmedi
  });

  it("kişisel rekor gelişti ama sınıf en hızlısı değilse YEŞİL yanar", () => {
    const prev = { c1: 95, c2: 105 };
    const { flashes } = detectFlashes(
      [car({ lapKey: "c1", bestSec: 95 }), car({ lapKey: "c2", bestSec: 100 })], prev);
    expect(flashes.c2).toBe("green");    // 100 < 105 (PB) ama 95 sınıf en hızlısı → yeşil
  });

  it("bestSec değişmezse flash yok", () => {
    const { flashes } = detectFlashes([car({ lapKey: "c1", bestSec: 100 })], { c1: 100 });
    expect(flashes).toEqual({});
  });

  it("bestSec kötüleşirse (artarsa) flash yok", () => {
    const { flashes } = detectFlashes([car({ lapKey: "c1", bestSec: 102 })], { c1: 100 });
    expect(flashes).toEqual({});
  });

  it("geçersiz bestSec (<=0) dokunmaz, prev korunur", () => {
    const { flashes, nextBest } = detectFlashes(
      [car({ lapKey: "c1", bestSec: -1 })], { c1: 100 });
    expect(flashes).toEqual({});
    expect(nextBest.c1).toBe(100);        // eski değer silinmez
  });

  it("farklı sınıflar ayrı değerlendirilir (her sınıfın kendi en hızlısı MOR)", () => {
    const prev = { c1: 100, c2: 200 };
    const { flashes } = detectFlashes([
      car({ lapKey: "c1", carClass: "Hypercar", bestSec: 99 }),
      car({ lapKey: "c2", carClass: "LMGT3", bestSec: 199 }),
    ], prev);
    expect(flashes.c1).toBe("purple");
    expect(flashes.c2).toBe("purple");   // kendi sınıfında en hızlı
  });

  it("boş/bozuk girdi çökmez", () => {
    expect(detectFlashes(null, {}).flashes).toEqual({});
    expect(detectFlashes([null, undefined], {}).flashes).toEqual({});
  });
});
