import { describe, it, expect } from "vitest";
import { trackOptions, classOptions, carOptions } from "./pickerOptions";
import { TRACKS, CAR_CLASSES, CARS } from "./constants";

describe("trackOptions", () => {
  const opts = trackOptions();
  it("her pist için value/label/icon üretir", () => {
    expect(opts).toHaveLength(TRACKS.length);
    for (const o of opts) {
      expect(o.value).toBeTruthy();
      expect(o.label).toBeTruthy();
      expect(o.icon).toMatch(/\/flags\/[a-z0-9-]+\.png$/);
    }
  });
  it("layout varyantı (spa-endurance) spa bayrağını paylaşır", () => {
    const se = opts.find((o) => o.value === "spa-endurance");
    expect(se.icon).toMatch(/\/flags\/spa\.png$/);
  });
});

describe("classOptions", () => {
  const opts = classOptions();
  it("5 sınıf, class ikonu", () => {
    expect(opts).toHaveLength(CAR_CLASSES.length);
    expect(opts.map((o) => o.value)).toEqual(CAR_CLASSES.map(([id]) => id));
    for (const o of opts) expect(o.icon).toMatch(/\/class\/[a-z0-9]+\.png$/);
  });
});

describe("carOptions", () => {
  it("sınıfın araçlarını marka logosu ikonuyla üretir", () => {
    const opts = carOptions("gt3");
    expect(opts).toHaveLength(CARS.gt3.length);
    // BMW M4 GT3 → brands/bmw.png (marka logosu öncelikli)
    const bmw = opts.find((o) => o.value === "bmw");
    expect(bmw.label).toMatch(/BMW/);
    expect(bmw.icon).toMatch(/\/brands\/bmw\.png$/);
  });
  it("marka eşleşmezse araç görseline düşer (icon boş kalmaz)", () => {
    for (const cls of Object.keys(CARS)) {
      for (const o of carOptions(cls)) {
        expect(o.icon).toBeTruthy();
        expect(o.icon).toMatch(/\/(brands|cars)\//);
      }
    }
  });
  it("bilinmeyen/boş sınıf → boş liste", () => {
    expect(carOptions("")).toEqual([]);
    expect(carOptions("yok")).toEqual([]);
    expect(carOptions(undefined)).toEqual([]);
  });
});
