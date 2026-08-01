import { describe, it, expect } from "vitest";
import { DEFAULT_STATE } from "./engine.js";
import { detectPitEntry, clockDriftSec, alignedStartMs, weatherSuggestion,
  avgLapSuggestion } from "./liveSync.js";

const st = (over = {}) => ({ ...DEFAULT_STATE, raceTime: "2:00:00",
  raceStartMs: 1_000_000, avgLap: "3:59.50", weatherLog: [], ...over });
const raceSes = (over = {}) => ({ sessionType: "Yarış", flag: "Green",
  phase: "Yeşil", timeLeftSec: 3600, ...over });

describe("detectPitEntry — ✔ PIT butonunun otomatik karşılığı", () => {
  it("pit dışı → pit içi geçişinde tetikler", () => {
    expect(detectPitEntry({ inPits: false, lapsDone: 5 },
      { inPits: true, lapsDone: 5 })).toBe(true);
    expect(detectPitEntry({ location: "TRACK", lapsDone: 5 },
      { location: "PIT", lapsDone: 5 })).toBe(true);
  });
  it("pit içinde kalmak / pit dışına çıkmak tetiklemez", () => {
    expect(detectPitEntry({ inPits: true, lapsDone: 5 },
      { inPits: true, lapsDone: 5 })).toBe(false);
    expect(detectPitEntry({ inPits: true, lapsDone: 5 },
      { inPits: false, lapsDone: 6 })).toBe(false);
  });
  it("tur atılmadan (grid/garaj) tetiklemez; eksik kare tetiklemez", () => {
    expect(detectPitEntry({ inPits: false, lapsDone: 0 },
      { inPits: true, lapsDone: 0 })).toBe(false);
    expect(detectPitEntry(null, { inPits: true, lapsDone: 5 })).toBe(false);
    expect(detectPitEntry({ inPits: false, lapsDone: 5 }, null)).toBe(false);
  });
});

describe("clockDriftSec / alignedStartMs — oyun saati otorite", () => {
  it("yarış+yeşilde işaretli kaymayı verir", () => {
    // start=1_000_000, yarış 7200 sn; now = start + 3_500_000 → plan kalan 3700
    const d = clockDriftSec(st(), raceSes({ timeLeftSec: 3600 }), 1_000_000 + 3_500_000);
    expect(d).toBe(100);                       // plan oyundan 100 sn geride
    const d2 = clockDriftSec(st(), raceSes({ timeLeftSec: 3800 }), 1_000_000 + 3_500_000);
    expect(d2).toBe(-100);
  });
  it("yarış dışı seans / yeşil değil / timeLeft yok → null", () => {
    expect(clockDriftSec(st(), raceSes({ sessionType: "Antrenman" }), 2_000_000)).toBeNull();
    expect(clockDriftSec(st(), raceSes({ flag: "FCY", phase: "FCY" }), 2_000_000)).toBeNull();
    expect(clockDriftSec(st(), raceSes({ timeLeftSec: null }), 2_000_000)).toBeNull();
    expect(clockDriftSec(st({ raceStartMs: NaN }), raceSes(), 2_000_000)).toBeNull();
  });
  it("hizalamadan sonra kayma ~0 (round-trip)", () => {
    const now = 1_000_000 + 3_500_000;
    const ses = raceSes({ timeLeftSec: 3600 });
    const s2 = st({ raceStartMs: alignedStartMs(st(), ses, now) });
    expect(Math.abs(clockDriftSec(s2, ses, now))).toBeLessThanOrEqual(0);
  });
});

describe("weatherSuggestion — canlı ıslaklıktan kademe (v1.4.76 oyun aralıkları)", () => {
  it("kademe ZEMİN ıslaklığından gelir (engine.wetnessLevel eşikleri)", () => {
    expect(weatherSuggestion({ rain: 0, wetness: 100 }, st()).id).toBe("xwet");
    expect(weatherSuggestion({ rain: 0, wetness: 60 }, st()).id).toBe("wet");
    expect(weatherSuggestion({ rain: 0, wetness: 20 }, st()).id).toBe("slwet");
    expect(weatherSuggestion({ rain: 0, wetness: 8 }, st()).id).toBe("damp");
  });
  it("kademe adı oyunun kelimesidir (yüzde değil)", () => {
    expect(weatherSuggestion({ rain: 0, wetness: 100 }, st()).label)
      .toBe("Extremely Wet");
    expect(weatherSuggestion({ rain: 0, wetness: 8 }, st()).label).toBe("Damp");
  });
  it("yağış yalnız BİLGİ (kademeyi belirlemez) — kelimeyle taşınır", () => {
    // Sağanak ama zemin daha kurumamış: plan kademesi zeminden, çipte yağış adı.
    const s = weatherSuggestion({ rain: 45, wetness: 60 }, st());
    expect(s.id).toBe("wet");
    expect(s.rainLbl).toBe("Rain");
    // Yağmur var ama zemin kuru → kademe "dry" → plan zaten kuru → öneri yok.
    expect(weatherSuggestion({ rain: 80, wetness: 0 }, st())).toBeNull();
  });
  it("plan zaten o kademedeyse null (kuru+kuru dahil)", () => {
    expect(weatherSuggestion({ rain: 0, wetness: 0 }, st())).toBeNull();
    const wetSt = st({ weatherLog: [{ t: 0, w: "wet" }] });
    expect(weatherSuggestion({ rain: 80, wetness: 60 }, wetSt)).toBeNull();
    // Aynı planda zemin tam %100'e ulaşırsa 5. kademe (xwet) önerilebilir.
    expect(weatherSuggestion({ rain: 80, wetness: 100 }, wetSt).id).toBe("xwet");
  });
  it("veri yoksa null", () => {
    expect(weatherSuggestion({}, st())).toBeNull();
    expect(weatherSuggestion(null, st())).toBeNull();
  });
});

describe("avgLapSuggestion", () => {
  it("%1 bandı içinde null, dışında fmtLap önerisi", () => {
    expect(avgLapSuggestion({ avg5Sec: 239.6 }, st())).toBeNull();   // 239.5'e çok yakın
    const s = avgLapSuggestion({ avg5Sec: 211.4 }, st());
    expect(s.txt).toBe("3:31.40");
  });
  it("canlı veri yoksa null", () => {
    expect(avgLapSuggestion(null, st())).toBeNull();
    expect(avgLapSuggestion({ avg5Sec: -1 }, st())).toBeNull();
  });
});
