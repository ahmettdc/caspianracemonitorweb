import { describe, it, expect } from "vitest";
import { classBestSectors, sectorTone, sectorTones, SEC_EPS } from "./liveSectors";

const car = (o) => ({ carClass: "Hypercar", ...o });

describe("classBestSectors", () => {
  it("sınıf başına en hızlı sektörleri toplar", () => {
    const out = classBestSectors([
      car({ bestSectors: [30.0, 44.0, 31.0] }),
      car({ bestSectors: [29.5, 45.0, 30.8] }),
      car({ carClass: "LMGT3", bestSectors: [33.0, 48.0, 34.0] }),
    ]);
    expect(out.hypercar).toEqual([29.5, 44.0, 30.8]);
    expect(out.gt3).toEqual([33.0, 48.0, 34.0]);
  });

  it("eksik / geçersiz sektörleri atlar, hepsi eksikse null kalır", () => {
    const out = classBestSectors([
      car({ bestSectors: [null, 44.0, -1] }),
      car({ bestSectors: [0, 43.5, undefined] }),
    ]);
    expect(out.hypercar).toEqual([null, 43.5, null]);
  });

  it("bestSectors olmayan aracı yok sayar; boş/bozuk girdide çökmez", () => {
    expect(classBestSectors([car({}), null, undefined])).toEqual({});
    expect(classBestSectors(null)).toEqual({});
    expect(classBestSectors([car({ bestSectors: "yok" })])).toEqual({});
  });
});

describe("sectorTone", () => {
  it("sınıf en iyisine eşit → MOR", () => {
    expect(sectorTone(29.5, 29.5, 29.5)).toBe("purple");
  });

  it("kişisel en iyi ama sınıf en iyisi değil → YEŞİL", () => {
    expect(sectorTone(30.0, 30.0, 29.5)).toBe("green");
  });

  it("ikisi de değil → null", () => {
    expect(sectorTone(31.2, 30.0, 29.5)).toBe(null);
  });

  it("MOR, YEŞİL'i ezer (sınıf rekoru kişisel rekoru kapsar)", () => {
    // araç sınıf rekorunu elinde tutuyor: pb == cb == val
    expect(sectorTone(29.5, 29.5, 29.5)).toBe("purple");
  });

  it("geçersiz süre (0/negatif/NaN) → null", () => {
    expect(sectorTone(0, 30, 29)).toBe(null);
    expect(sectorTone(-1, 30, 29)).toBe(null);
    expect(sectorTone(null, 30, 29)).toBe(null);
    expect(sectorTone(undefined, 30, 29)).toBe(null);
  });

  it("referans yoksa o kural uygulanmaz", () => {
    expect(sectorTone(30.0, null, null)).toBe(null);
    expect(sectorTone(30.0, 30.0, null)).toBe("green");
    expect(sectorTone(30.0, null, 30.0)).toBe("purple");
  });

  it("yuvarlama toleransı (3 ondalık) içinde eşit sayılır", () => {
    expect(sectorTone(29.5 + SEC_EPS / 2, 29.6, 29.5)).toBe("purple");
    // toleransı aşınca artık rekor sayılmaz — pb ve cb'nin İKİSİ de 29.5 olmalı,
    // yoksa değer hâlâ (daha yavaş olan) kişisel best'ten iyi kalır ve yeşil olur.
    expect(sectorTone(29.5 + SEC_EPS * 5, 29.5, 29.5)).toBe(null);
  });
});

describe("sectorTones", () => {
  const field = [
    car({ carId: 1, bestSectors: [29.5, 44.0, 30.8] }),
    car({ carId: 2, bestSectors: [30.0, 43.5, 31.0] }),
  ];
  const cb = classBestSectors(field);   // hypercar → [29.5, 43.5, 30.8]

  it("her sektörü bağımsız renklendirir", () => {
    // 1. araç: S1 sınıf rekoru (mor), S2 kişisel best ama sınıf değil (yeşil), S3 kötü
    expect(sectorTones([29.5, 44.0, 32.0], field[0], cb))
      .toEqual(["purple", "green", null]);
  });

  it("anlık turda henüz geçilmemiş sektör (null) renk almaz", () => {
    expect(sectorTones([29.5, null, null], field[0], cb))
      .toEqual(["purple", null, null]);
  });

  it("bestSectors / sınıf verisi yoksa çökmeden null döner", () => {
    expect(sectorTones([30, 44, 31], car({}), {})).toEqual([null, null, null]);
    expect(sectorTones(null, car({}), {})).toEqual([null, null, null]);
  });

  it("farklı sınıfın rekoru bu satırı etkilemez", () => {
    const gt3 = car({ carClass: "LMGT3", bestSectors: [33.0, 48.0, 34.0] });
    const all = classBestSectors([...field, gt3]);
    // GT3 aracı kendi sınıfının rekorunu tutuyor → mor (Hypercar'ın 29.5'i etkilemez)
    expect(sectorTones([33.0, 48.0, 34.0], gt3, all))
      .toEqual(["purple", "purple", "purple"]);
  });
});
