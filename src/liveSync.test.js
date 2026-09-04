import { describe, it, expect } from "vitest";
import { DEFAULT_STATE } from "./engine.js";
import { detectPitEntry, clockDriftSec, alignedStartMs, weatherSuggestion,
  avgLapSuggestion, isFrameFresh } from "./liveSync.js";

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
  it("YARIŞ ÖNCESİ geri sayım/formasyon → null (flag=Green ama faz Yeşil DEĞİL)", () => {
    // v1.8.9 bug: köprü _flag_of Grid/Formasyon/Geri Sayım'da da flag='Green' verir;
    // o sırada timeLeftSec = geri sayım (ör. 90 sn) → hizalama yarışı "bitmiş" sanıyordu.
    for (const phase of ["Geri Sayım", "Formasyon", "Grid", "Isınma"]) {
      expect(clockDriftSec(st(), raceSes({ flag: "Green", phase, timeLeftSec: 90 }),
        1_000_000 + 3_500_000)).toBeNull();
    }
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

/* REGRESYON (v2.4.1) — BAYAT KARE PLANA YAZAMAZ.
   useLiveSync karenin YAŞINA hiç bakmıyordu. LiveTab'de "bağlantı koptu"
   koruması (30 sn) var ama bu hook'ta yoktu: B yarışının live düğümünde
   köprünün günler önce bıraktığı son kare duruyorsa (araç garajda/pitte,
   sessionType "Yarış", by = benim e-postam) o kare tek başına sahte bir
   markPit() bastırabiliyor ve bayat timeLeftSec ile raceStartMs'i
   kaydırabiliyordu — tüm stint pencereleri kayardı. */
describe("isFrameFresh — yalnız TAZE kare plana yazabilir", () => {
  const now = 1_700_000_000_000;

  it("2 Hz'lik normal akış taze", () => {
    expect(isFrameFresh(now - 500, now)).toBe(true);
    expect(isFrameFresh(now, now)).toBe(true);
  });

  it("eşiğin altı taze, üstü bayat (30 sn)", () => {
    expect(isFrameFresh(now - 29_999, now)).toBe(true);
    expect(isFrameFresh(now - 30_001, now)).toBe(false);
    expect(isFrameFresh(now - 3 * 24 * 3600e3, now)).toBe(false);   // günler önce
  });

  it("gelecekten gelen kare (saat farkı) bayat DEĞİLDİR", () => {
    expect(isFrameFresh(now + 2000, now)).toBe(true);
  });

  it("eksik/bozuk ts → yazma (uydurma yok)", () => {
    expect(isFrameFresh(null, now)).toBe(false);
    expect(isFrameFresh(undefined, now)).toBe(false);
    expect(isFrameFresh(0, now)).toBe(false);
    expect(isFrameFresh("abc", now)).toBe(false);
    /* `Number(null) === 0` tuzağı: eksik `now` sayıya çevrilince 0 olur ve 0
       sonludur — koruma önce VARLIĞA bakmalı (CLAUDE.md §1). */
    expect(isFrameFresh(now, null)).toBe(false);
    expect(isFrameFresh(now, undefined)).toBe(false);
    expect(isFrameFresh(now, "")).toBe(false);
    expect(isFrameFresh("", now)).toBe(false);
  });

  it("eşik çağırandan geçirilebilir", () => {
    expect(isFrameFresh(now - 5000, now, 1000)).toBe(false);
    expect(isFrameFresh(now - 500, now, 1000)).toBe(true);
  });
});
