import { describe, it, expect } from "vitest";
import { msToLap, mapTrackId, mapClassId, carModelId, buildLaptimes, mergeLaptimes, applyTrackAliases } from "./lmuLaptimes.js";

describe("msToLap", () => {
  it("ms → m:ss.mmm (salise korunur)", () => {
    expect(msToLap(102123)).toBe("1:42.123");
    expect(msToLap(130724)).toBe("2:10.724");
    expect(msToLap(60000)).toBe("1:00.000");
    expect(msToLap(5000)).toBe("0:05.000");
  });
  it("geçersiz → ''", () => {
    expect(msToLap(0)).toBe("");
    expect(msToLap(-5)).toBe("");
    expect(msToLap("çöp")).toBe("");
  });
});

describe("mapTrackId", () => {
  it("lmuportal track_friendly varyantları → app id", () => {
    expect(mapTrackId("Spa-Francorchamps")).toBe("spa");
    expect(mapTrackId("Le Mans")).toBe("lemans");
    expect(mapTrackId("Fuji Speedway")).toBe("fuji");
    expect(mapTrackId("Circuit of the Americas")).toBe("cota");
    expect(mapTrackId("LagunaSeca_2026")).toBe("lagunaseca");
    expect(mapTrackId("Portimão")).toBe("portimao");
  });
  it("bilinmeyen pist → ''", () => expect(mapTrackId("Nürburgring")).toBe(""));
});

describe("mapClassId", () => {
  it("metadata.class → app sınıf id", () => {
    expect(mapClassId("Hyper")).toBe("hypercar");
    expect(mapClassId("GT3")).toBe("gt3");
    expect(mapClassId("LMP2")).toBe("lmp2");
    expect(mapClassId("LMP2_ELMS")).toBe("lmp2");
    expect(mapClassId("LMP3")).toBe("lmp3");
  });
  it("bilinmeyen → ''", () => expect(mapClassId(null)).toBe(""));
});

describe("carModelId — §1: yalnız model kodu açıkken eşler", () => {
  it("Custom Team liveryleri model kodunu taşır → eşlenir", () => {
    expect(carModelId("499P Custom Team 2026 #397", "hypercar")).toBe("ferrari");
    expect(carModelId("Porsche 963 Custom Team 2025 #397", "hypercar")).toBe("porsche");
    expect(carModelId("911GT3R Custom Team 2026 #397", "gt3")).toBe("porsche");
    expect(carModelId("296GT3 Custom Team 2026 #397", "gt3")).toBe("ferrari");
    expect(carModelId("Oreca 07 Custom Team 2025 #397", "lmp2")).toBe("oreca");
  });
  it("üreticiyi belli ETMEYEN takım adı → '' (uydurma yok)", () => {
    expect(carModelId("Garage 59 2026 #10", "gt3")).toBe("");
    expect(carModelId("Akkodis ASP Team 2026 #78", "gt3")).toBe("");
    expect(carModelId("AF Corse 2026 #83", "hypercar")).toBe("");
    expect(carModelId("DKR Engineering #4", "lmp3")).toBe("");
  });
});

describe("buildLaptimes", () => {
  const mk = (trackLabel, classRaw, scoreMs, car, initials) =>
    ({ trackLabel, classRaw, scoreMs, car, initials, sectors: [30, 40, 32], compound: ["Medium"], drRank: "Silver", srRank: "Gold" });

  it("P1 = en hızlı; avgLap = P1×1.02; top sıralı", () => {
    const d = buildLaptimes([
      mk("Spa-Francorchamps", "Hyper", 205255, "Peugeot TotalEnergies #93", "GW"),
      mk("Spa-Francorchamps", "Hyper", 205000, "499P Custom Team 2026 #397", "MM"),
      mk("Spa-Francorchamps", "Hyper", 206000, "BMW M Team WRT 2026 #20", "AB"),
    ]);
    const e = d.spa.hypercar;
    expect(e.hot).toBe(msToLap(205000));             // gerçek P1
    expect(e.avgLap).toBe(msToLap(Math.round(205000 * 1.02))); // modellenmiş tempo
    expect(e.p1.driver).toBe("MM");
    expect(e.p1.carId).toBe("ferrari");              // 499P → ferrari
    expect(e.top.map((x) => x.rank)).toEqual([1, 2, 3]);
    expect(e.top.map((x) => x.lapMs)).toEqual([205000, 205255, 206000]);
  });

  it("geçersiz tur ve eşlenemeyen pist/sınıf atlanır (uydurma yok)", () => {
    const d = buildLaptimes([
      mk("Spa", "GT3", 0, "x", "x"),            // geçersiz skor
      mk("Nürburgring", "GT3", 120000, "x", "x"), // bilinmeyen pist
      mk("Spa", "F1", 120000, "x", "x"),          // bilinmeyen sınıf
      mk("Spa", "GT3", 138000, "Garage 59 #10", "ZZ"), // geçerli
    ]);
    expect(Object.keys(d)).toEqual(["spa"]);
    expect(Object.keys(d.spa)).toEqual(["gt3"]);
    expect(d.spa.gt3.top).toHaveLength(1);
    expect(d.spa.gt3.top[0].carId).toBe("");        // takım adı → eşlenmez
    expect(d.spa.gt3.top[0].car).toBe("Garage 59 #10"); // ama aynen korunur
  });

  it("boş girdi → boş obje", () => expect(buildLaptimes([])).toEqual({}));
});

describe("mergeLaptimes — primary kazanır, secondary boşluğu doldurur", () => {
  const primary = { spa: { gt3: { hot: "2:18.000", avgLap: "2:20.760", p1: {}, top: [1, 2] } } };
  const secondary = {
    spa: { gt3: { hot: "9:99.999", avgLap: "x", p1: {}, top: [0] }, hypercar: { hot: "2:00.000", avgLap: "2:02.400", p1: {}, top: [1] } },
    monza: { lmp2: { hot: "1:40.000", avgLap: "1:41.800", p1: {}, top: [1] } },
  };
  const m = mergeLaptimes(primary, secondary);
  it("primary pist×sınıf korunur (secondary ezemez)", () => {
    expect(m.spa.gt3.hot).toBe("2:18.000");
    expect(m.spa.gt3.top).toEqual([1, 2]);
  });
  it("secondary yalnız eksik pist×sınıf'ı ekler", () => {
    expect(m.spa.hypercar.hot).toBe("2:00.000"); // spa'da eksik sınıf eklendi
    expect(m.monza.lmp2.hot).toBe("1:40.000");    // tamamen yeni pist eklendi
  });
  it("boş argümanlar güvenli", () => {
    expect(mergeLaptimes(null, null)).toEqual({});
    expect(mergeLaptimes(primary, null)).toEqual(primary);
  });
});

describe("applyTrackAliases — spa → spa-endurance (aynı fiziksel pist)", () => {
  it("spa varsa spa-endurance'a kopyalanır", () => {
    const d = { spa: { gt3: { hot: "2:18.0" } } };
    const out = applyTrackAliases(d);
    expect(out["spa-endurance"]).toBe(out.spa);
  });
  it("spa-endurance zaten varsa EZİLMEZ; spa yoksa no-op", () => {
    const d = { spa: { gt3: {} }, "spa-endurance": { gt3: { hot: "own" } } };
    expect(applyTrackAliases(d)["spa-endurance"].gt3.hot).toBe("own");
    expect(applyTrackAliases({ monza: {} })["spa-endurance"]).toBeUndefined();
  });
});
