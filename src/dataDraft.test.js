/* Yarış datası paneli — sahnele + uygula mantığı (tasarım §14).
   Kural: taslaktaki değişiklikler Uygula'ya basılana dek state'e (dolayısıyla
   Firebase'e) geçmez; "N alan değişti" sayacı ve "Bu değişiklik neyi etkiler"
   listesi yalnız GERÇEKTEN farklı alanları sayar. */
import { describe, it, expect } from "vitest";
import {
  sameFieldValue, draftChangedKeys, draftPatch, draftEffectIds, DATA_EFFECTS,
} from "./state.js";

const base = {
  raceTime: "6:00:00", avgLap: "2:18.40", tyreLimit: 8, consumption: 1.4,
  chosen: "A", strategies: { A: 7, B: 8, C: 9, D: 10 },
  weather: "dry", weatherLog: [{ t: 0, w: "dry", src: "plan" }],
  multiclass: false, streamUrl: "",
};

describe("sameFieldValue", () => {
  it("skaler değerleri karşılaştırır", () => {
    expect(sameFieldValue(8, 8)).toBe(true);
    expect(sameFieldValue(8, 9)).toBe(false);
    expect(sameFieldValue("a", "a")).toBe(true);
    expect(sameFieldValue(false, false)).toBe(true);
  });
  it("nesne/dizi alanlarda derin karşılaştırma yapar (referans değil)", () => {
    expect(sameFieldValue({ A: 7 }, { A: 7 })).toBe(true);
    expect(sameFieldValue({ A: 7 }, { A: 8 })).toBe(false);
    expect(sameFieldValue([{ t: 0 }], [{ t: 0 }])).toBe(true);
    expect(sameFieldValue([{ t: 0 }], [{ t: 1 }])).toBe(false);
  });
});

describe("draftChangedKeys", () => {
  it("taslak yoksa değişiklik yok", () => {
    expect(draftChangedKeys(base, null)).toEqual([]);
    expect(draftChangedKeys(base, {})).toEqual([]);
  });
  it("yalnız farklı alanları sayar", () => {
    expect(draftChangedKeys(base, { raceTime: "8:00:00" })).toEqual(["raceTime"]);
    expect(draftChangedKeys(base, { raceTime: "6:00:00" })).toEqual([]);
  });
  it("aynı değere geri dönen alan düşer (sayaç sıfırlanır)", () => {
    const draft = { tyreLimit: 10 };
    expect(draftChangedKeys(base, draft)).toEqual(["tyreLimit"]);
    expect(draftChangedKeys(base, { tyreLimit: 8 })).toEqual([]);
  });
  it("nesne alanları derin karşılaştırır", () => {
    expect(draftChangedKeys(base, { strategies: { A: 7, B: 8, C: 9, D: 10 } })).toEqual([]);
    expect(draftChangedKeys(base, { strategies: { A: 6, B: 8, C: 9, D: 10 } }))
      .toEqual(["strategies"]);
  });
  it("birden çok alanı birlikte sayar", () => {
    const ch = draftChangedKeys(base, { raceTime: "8:00:00", tyreLimit: 12, avgLap: "2:18.40" });
    expect(ch.sort()).toEqual(["raceTime", "tyreLimit"]);
  });
});

describe("draftPatch — Uygula'da yazılacak alanlar", () => {
  it("yalnız değişenleri içerir (değişmeyen alan yazılmaz)", () => {
    const patch = draftPatch(base, { raceTime: "8:00:00", avgLap: "2:18.40", tyreLimit: 12 });
    expect(patch).toEqual({ raceTime: "8:00:00", tyreLimit: 12 });
    expect("avgLap" in patch).toBe(false);
  });
  it("değişiklik yoksa boş patch", () => {
    expect(draftPatch(base, { chosen: "A" })).toEqual({});
    expect(draftPatch(base, null)).toEqual({});
  });
  it("uygulanan patch base'e işlenince taslak değerleri kalıcı olur", () => {
    const draft = { raceTime: "8:00:00", strategies: { A: 6, B: 8, C: 9, D: 10 } };
    const next = { ...base, ...draftPatch(base, draft) };
    expect(next.raceTime).toBe("8:00:00");
    expect(next.strategies.A).toBe(6);
    expect(next.avgLap).toBe(base.avgLap);          // dokunulmayan alan korunur
    expect(draftChangedKeys(next, draft)).toEqual([]); // uygulandıktan sonra temiz
  });
});

describe("draftEffectIds — 'Bu değişiklik neyi etkiler'", () => {
  it("değişiklik yoksa liste boş", () => {
    expect(draftEffectIds([])).toEqual([]);
    expect(draftEffectIds(null)).toEqual([]);
  });
  it("lastik limiti yalnız lastik uyarılarını etkiler", () => {
    expect(draftEffectIds(["tyreLimit"])).toEqual(["tyre"]);
  });
  it("avgLap hem stint planını hem yakıt hesabını etkiler", () => {
    expect(draftEffectIds(["avgLap"])).toEqual(["stint", "fuel"]);
  });
  it("stream/link gibi alanlar hesap etkilemez", () => {
    expect(draftEffectIds(["streamUrl"])).toEqual([]);
  });
  it("sıra sabit: stint → fuel → tyre", () => {
    expect(draftEffectIds(["tyreLimit", "consumption", "raceTime"]))
      .toEqual(["stint", "fuel", "tyre"]);
  });
  it("etki tablosu bilinen alanları kapsar", () => {
    expect(DATA_EFFECTS.stint).toContain("raceStartMs");
    expect(DATA_EFFECTS.fuel).toContain("fuelRatio");
    expect(DATA_EFFECTS.tyre).toEqual(["tyreLimit"]);
  });
});
