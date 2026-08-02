import { describe, it, expect } from "vitest";
import { matchVehicle, detectVehicle } from "./setupAutofill";
import { parseSvm } from "./setupParse";
import { CARS } from "./constants";

describe("matchVehicle", () => {
  it("gerçek örnek: GT3 Porsche (kullanıcının dosyası)", () => {
    expect(matchVehicle("GT3 Porsche_911_GT3_R_LMGT3 WEC2024"))
      .toEqual({ cls: "gt3", car: "porsche" });
  });

  it("GT3 kataloğunun tamamı eşleşir (marka adından)", () => {
    const samples = {
      ferrari: "GT3 Ferrari_296_GT3 WEC2024",
      porsche: "GT3 Porsche_911_GT3_R_LMGT3",
      bmw: "GT3 BMW_M4_GT3 WEC2024",
      mercedes: "LMGT3 Mercedes_AMG_GT3_EVO",
      mclaren: "GT3 McLaren_720S_GT3_EVO",
      corvette: "GT3 Chevrolet_Corvette_Z06_GT3R",
      lexus: "GT3 Lexus_RC_F_GT3",
      ford: "GT3 Ford_Mustang_GT3",
      aston: "GT3 Aston_Martin_Vantage_AMR_GT3",
    };
    for (const [car, str] of Object.entries(samples)) {
      expect(matchVehicle(str), str).toEqual({ cls: "gt3", car });
    }
  });

  it("Hypercar örnekleri", () => {
    expect(matchVehicle("Hypercar Porsche_963 WEC2024"))
      .toEqual({ cls: "hypercar", car: "porsche" });
    expect(matchVehicle("LMH Toyota_GR010_Hybrid"))
      .toEqual({ cls: "hypercar", car: "toyota" });
    expect(matchVehicle("LMDh Cadillac_V-Series.R"))
      .toEqual({ cls: "hypercar", car: "cadillac" });
  });

  it("LMP2 (tek araç)", () => {
    expect(matchVehicle("LMP2 Oreca_07_Gibson")).toEqual({ cls: "lmp2", car: "oreca" });
  });

  it("eşleşmeyen sınıf/araç → null (uydurma yok)", () => {
    expect(matchVehicle("Foo Bar_Baz")).toBeNull();
    expect(matchVehicle("GT3 Bilinmeyen_Marka_X")).toBeNull();
    expect(matchVehicle("")).toBeNull();
    expect(matchVehicle(null)).toBeNull();
  });

  it("her sınıfın her aracı kendi id'siyle eşleşir (katalog taraması)", () => {
    for (const [cls, cars] of Object.entries(CARS)) {
      const clsWord = cls === "hypercar" ? "Hypercar" : cls.toUpperCase();
      for (const c of cars) {
        const str = `${clsWord} ${c.name.replace(/ /g, "_")}`;
        const m = matchVehicle(str);
        expect(m, str).not.toBeNull();
        expect(m.cls, str).toBe(cls);
      }
    }
  });
});

describe("detectVehicle", () => {
  it("parseSvm çıktısından VehicleClassSetting satırını bulur", () => {
    const parsed = parseSvm(
      'VehicleClassSetting="GT3 Porsche_911_GT3_R_LMGT3 WEC2024"\n[GENERAL]\nFuelSetting=82//0.83');
    expect(detectVehicle(parsed)).toEqual({ cls: "gt3", car: "porsche" });
  });
  it("satır yoksa / parse başarısızsa null", () => {
    expect(detectVehicle(parseSvm("[GENERAL]\nFuelSetting=82//0.83"))).toBeNull();
    expect(detectVehicle({ ok: false })).toBeNull();
    expect(detectVehicle(null)).toBeNull();
  });
});
