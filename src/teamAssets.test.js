import { describe, it, expect } from "vitest";
import { carAssetKey, carImageSrc, teamLogoSrc } from "./teamAssets.js";

const URI = "data:image/webp;base64,AAAA";

describe("carAssetKey", () => {
  it("sınıf+id birleşimi (ferrari birden çok sınıfta var)", () => {
    expect(carAssetKey("gt3", "ferrari")).toBe("gt3_ferrari");
    expect(carAssetKey("hypercar", "ferrari")).toBe("hypercar_ferrari");
  });
});

describe("carImageSrc", () => {
  it("özel görsel varsa onu döndürür (side + top)", () => {
    const assets = { cars: { gt3_porsche: { side: URI, top: URI } } };
    expect(carImageSrc(assets, "gt3", "porsche", "side")).toBe(URI);
    expect(carImageSrc(assets, "gt3", "porsche", "top")).toBe(URI);
  });

  it("özel görsel yoksa statik fallback: side → cars/{cls}/{id}.png", () => {
    const s = carImageSrc(null, "gt3", "porsche", "side");
    expect(s).toContain("cars/gt3/porsche.png");
  });

  it("fallback img alias'ı korunur (astonmartin → aston.png)", () => {
    const s = carImageSrc({}, "hypercar", "astonmartin", "side");
    expect(s).toContain("cars/hypercar/aston.png");
  });

  it("top fallback tek jenerik görsel: cartop/default.png", () => {
    const s = carImageSrc({ cars: {} }, "gt3", "porsche", "top");
    expect(s).toContain("cartop/default.png");
  });

  it("başka aracın özel görseli sızmaz (anahtar sınıf+id)", () => {
    const assets = { cars: { gt3_ferrari: { side: URI } } };
    expect(carImageSrc(assets, "hypercar", "ferrari", "side"))
      .toContain("cars/hypercar/ferrari.png");
  });

  it("bozuk/dataURI olmayan değer → fallback (güvenlik)", () => {
    const assets = { cars: { gt3_porsche: { side: "https://evil/x.png" } } };
    expect(carImageSrc(assets, "gt3", "porsche", "side"))
      .toContain("cars/gt3/porsche.png");
  });
});

describe("teamLogoSrc", () => {
  it("logo dataURI ise döndürür", () => {
    expect(teamLogoSrc({ logo: URI })).toBe(URI);
  });

  it("yoksa/bozuksa boş string (çağıran fallback ikon gösterir)", () => {
    expect(teamLogoSrc(null)).toBe("");
    expect(teamLogoSrc({})).toBe("");
    expect(teamLogoSrc({ logo: "http://x/logo.png" })).toBe("");
    expect(teamLogoSrc({ logo: 42 })).toBe("");
  });
});
