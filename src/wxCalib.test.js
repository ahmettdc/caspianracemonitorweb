import { describe, it, expect } from "vitest";
import { addSample, thresholdsFrom, exportPayload, CALIB_WORDS, CALIB_MAX } from "./wxCalib.js";

const ses = (wetness, rain = 0) => ({ wetness, rain });

describe("addSample — damga alma", () => {
  it("geçerli damgayı yüzdelerle birlikte ekler", () => {
    const out = addSample([], "Damp", ses(12.4, 8.6), 1000);
    expect(out).toEqual([{ ts: 1000, word: "Damp", wetness: 12, rain: 9 }]);
  });
  it("bilinmeyen kelime eklenmez", () => {
    expect(addSample([], "Soaked", ses(50))).toEqual([]);
  });
  it("ıslaklık verisi yoksa örnek ALINMAZ (0'lar eşiği bozmasın)", () => {
    expect(addSample([], "Wet", ses(null))).toEqual([]);
    expect(addSample([], "Wet", undefined)).toEqual([]);
    expect(addSample([], "Wet", ses("abc"))).toEqual([]);
  });
  it("yağış yoksa null yazılır ama damga alınır", () => {
    expect(addSample([], "Wet", { wetness: 60 })[0].rain).toBeNull();
  });
  it("tampon CALIB_MAX ile sınırlı, en yenisi korunur", () => {
    let list = [];
    for (let i = 0; i < CALIB_MAX + 25; i++) list = addSample(list, "Dry", ses(i % 100), i);
    expect(list).toHaveLength(CALIB_MAX);
    expect(list.at(-1).ts).toBe(CALIB_MAX + 24);
  });
});

describe("thresholdsFrom — eşik önerisi", () => {
  const samples = [
    { ts: 1, word: "Dry", wetness: 3 },
    { ts: 2, word: "Damp", wetness: 11 },
    { ts: 3, word: "Damp", wetness: 26 },
    { ts: 4, word: "Slightly Wet", wetness: 34 },
    { ts: 5, word: "Wet", wetness: 58 },
  ];
  it("kelime başına min/max/n verir", () => {
    const t = thresholdsFrom(samples);
    expect(t.find((x) => x.word === "Damp")).toEqual({ word: "Damp", n: 2, min: 11, max: 26 });
    expect(t.find((x) => x.word === "Wet").min).toBe(58);
  });
  it("sıralama kuru → ıslak (CALIB_WORDS düzeni), veri olmayan kelime yok", () => {
    expect(thresholdsFrom(samples).map((x) => x.word))
      .toEqual(["Dry", "Damp", "Slightly Wet", "Wet"]);
  });
  it("boş/bozuk girdi çökmez", () => {
    expect(thresholdsFrom(null)).toEqual([]);
    expect(thresholdsFrom([null, 5, { word: "Wet" }, { word: "X", wetness: 9 }])).toEqual([]);
  });
});

describe("exportPayload", () => {
  it("damgaları ve özeti içeren geçerli JSON üretir", () => {
    const j = JSON.parse(exportPayload([{ ts: 1, word: "Wet", wetness: 60, rain: 40 }],
      { track: "Le Mans" }));
    expect(j.kind).toBe("caspian-wx-calib");
    expect(j.track).toBe("Le Mans");
    expect(j.samples).toHaveLength(1);
    expect(j.summary[0]).toEqual({ word: "Wet", n: 1, min: 60, max: 60 });
  });
});

describe("CALIB_WORDS", () => {
  it("'Very Wet' listede — gerçekten var mı ÖLÇÜMLE anlaşılacak", () => {
    expect(CALIB_WORDS).toContain("Very Wet");
    expect(CALIB_WORDS[0]).toBe("Dry");
    expect(CALIB_WORDS.at(-1)).toBe("Extremely Wet");
  });
});
