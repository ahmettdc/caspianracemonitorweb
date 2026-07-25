import { describe, it, expect } from "vitest";
import {
  parseHMS, parseLap, fmtHMS, fmtLap, msToLocalInput,
  DEFAULT_STATE, WEATHER, wxLog, wxAtRel, WX, effLapSec, effCons, tyState,
  computePlan, migrate, lastStintFuel,
} from "./engine.js";

/* Temiz, deterministik bir durum kur — testler bunun üstünden yürür. */
const baseState = (over = {}) => ({
  ...DEFAULT_STATE,
  raceTime: "1:00:00",   // 3600 sn
  avgLap: "4:00.00",     // 240 sn
  consumption: 10,       // %/tur
  strategies: { A: 5, B: 8, C: 10, D: 11 },
  chosen: "C",           // stint başına 10 tur
  weatherLog: [],        // tümü dry
  pitLaneTime: 20,
  fuelTime: 40,
  extraLap: 1,
  fuelRatio: 0.86,
  multiclass: false,
  leaderLap: "",
  ...over,
});

describe("zaman/tur ayrıştırma", () => {
  it("parseHMS: hh:mm:ss, mm:ss, ss ve virgül", () => {
    expect(parseHMS("2:24:00")).toBe(8640);
    expect(parseHMS("1:30")).toBe(90);
    expect(parseHMS("45")).toBe(45);
    expect(parseHMS("")).toBe(0);
    expect(parseHMS("3:59,50")).toBeCloseTo(239.5, 6);
  });
  it("parseLap: m:ss.dd ve virgül/nokta", () => {
    expect(parseLap("3:59.50")).toBeCloseTo(239.5, 6);
    expect(parseLap("3:59,50")).toBeCloseTo(239.5, 6);
    expect(parseLap("95.5")).toBeCloseTo(95.5, 6);
    expect(parseLap("")).toBe(0);
  });
  it("fmtHMS: pozitif/negatif/sıfır", () => {
    expect(fmtHMS(8640)).toBe("02:24:00");
    expect(fmtHMS(0)).toBe("00:00:00");
    expect(fmtHMS(-90)).toBe("-00:01:30");
  });
  it("fmtLap: dakika:saniye.yüzde", () => {
    expect(fmtLap(239.5)).toBe("3:59.50");
    expect(fmtLap(65)).toBe("1:05.00");
    expect(fmtLap(5)).toBe("0:05.00");
  });
  it("msToLocalInput: geçersizde boş", () => {
    expect(msToLocalInput(0)).toBe("");
    expect(msToLocalInput(NaN)).toBe("");
    expect(msToLocalInput(Date.now())).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe("hava modeli", () => {
  it("wxLog kronolojik sıralar", () => {
    const st = { weatherLog: [{ t: 100, w: "wet" }, { t: 0, w: "dry" }] };
    expect(wxLog(st).map((e) => e.t)).toEqual([0, 100]);
  });
  it("wxAtRel: boş log dry döner", () => {
    expect(wxAtRel([], 500)).toBe(WEATHER.dry);
  });
  it("wxAtRel: zamana göre doğru segment", () => {
    const log = [{ t: 0, w: "wet" }, { t: 1000, w: "dry" }];
    expect(wxAtRel(log, 500)).toBe(WEATHER.wet);
    expect(wxAtRel(log, 1500)).toBe(WEATHER.dry);
  });
  it("WX en güncel havayı verir", () => {
    expect(WX({ weatherLog: [{ t: 0, w: "wet" }] })).toBe(WEATHER.wet);
    expect(WX({ weatherLog: [] })).toBe(WEATHER.dry);
  });
  it("effLapSec / effCons hava çarpanını uygular", () => {
    const dry = { avgLap: "4:00.00", consumption: 10, weatherLog: [] };
    const wet = { avgLap: "4:00.00", consumption: 10, weatherLog: [{ t: 0, w: "wet" }] };
    expect(effLapSec(dry)).toBeCloseTo(240, 6);
    expect(effLapSec(wet)).toBeCloseTo(240 * 1.13, 6);
    expect(effCons(dry)).toBeCloseTo(10, 6);
    expect(effCons(wet)).toBeCloseTo(10 * 0.92, 6);
  });
});

describe("tyState normalize", () => {
  it("boolean ve sayıyı normalize eder", () => {
    expect(tyState(true)).toBe(1);
    expect(tyState(false)).toBe(0);
    expect(tyState(3)).toBe(3);
    expect(tyState("2")).toBe(2);
    expect(tyState(undefined)).toBe(0);
  });
});

describe("migrate", () => {
  it("eksik dizileri güvenle doldurur", () => {
    const m = migrate({});
    expect(Array.isArray(m.lapOverrides)).toBe(true);
    expect(m.lapOverrides.length).toBe(64);
    expect(m.weatherLog).toEqual([]);
  });
  it("eski tek 'weather' seçimini kronolojik log'a çevirir", () => {
    expect(migrate({ weather: "wet" }).weatherLog).toEqual([{ t: 0, w: "wet" }]);
    expect(migrate({ weather: "dry" }).weatherLog).toEqual([]);
  });
  it("eski raceStart metnini epoch'a çevirir", () => {
    const t = Date.parse("2026-01-01T00:00:00Z");
    expect(migrate({ raceStartMs: 0, raceStart: "2026-01-01T00:00:00Z" }).raceStartMs).toBe(t);
  });
});

describe("lastStintFuel", () => {
  it("ondalık turu yukarı yuvarlar, extra lap ekler", () => {
    const st = baseState();
    // countdown 8:10 = 490 sn, tur 240 sn → 2.04 tur → yukarı 3
    const r = lastStintFuel("0:08:10", st);
    expect(r.lapsRaw).toBeCloseTo(490 / 240, 6);
    expect(r.lapsLeft).toBe(3);
    expect(r.refuel).toBeCloseTo((3 + 1) * 10, 6);   // (tur + extraLap) × tüketim
    expect(r.refuelL).toBeCloseTo(40 * 0.86, 6);
  });
  it("tam katta gereksiz yukarı yuvarlama yapmaz", () => {
    // 8:00 = 480 sn → tam 2 tur (1e-6 payı fazladan tur eklememeli)
    expect(lastStintFuel("0:08:00", baseState()).lapsLeft).toBe(2);
  });
  it("flagExtra (lider bayrağı) süreyi uzatır", () => {
    const r = lastStintFuel("0:08:00", baseState(), 240); // +1 tur süresi
    expect(r.lapsLeft).toBe(3);
  });
});

describe("computePlan — çekirdek strateji", () => {
  it("tek stintlik kısa yarış deterministik", () => {
    // 20 dk = 1200 sn, tur 240 sn → tek stint biter
    const plan = computePlan(baseState({ raceTime: "0:20:00" }), "race");
    expect(plan.raceSec).toBe(1200);
    expect(plan.lapSec).toBeCloseTo(240, 6);
    expect(plan.laps).toBe(10);
    expect(plan.rows.length).toBe(1);
    expect(plan.rows[0].isLast).toBe(true);
    expect(plan.rows[0].lapsInStint).toBe(6); // 5 tam tur + bayrak turu
    expect(plan.totalLaps).toBe(6);
    expect(plan.flagExtra).toBe(0);
    expect(plan.rows[0].pitSec).toBe(0); // son stintte pit yok
  });

  it("çok stintli yarış: son satır isLast, bitiş = raceSec", () => {
    const plan = computePlan(baseState(), "race"); // 1 saat
    expect(plan.rows.length).toBeGreaterThan(1);
    const last = plan.rows[plan.rows.length - 1];
    expect(last.isLast).toBe(true);
    expect(last.endSec).toBeCloseTo(plan.raceSec, 3);
    expect(plan.totalLaps).toBeGreaterThan(0);
  });

  it("süre override'ı stint uzunluğuna uyulur", () => {
    const over = [...DEFAULT_STATE.overrides];
    over[0] = "0:10:00"; // ilk stint 600 sn'ye kilitli
    const plan = computePlan(baseState({ raceTime: "0:20:00", overrides: over }), "race");
    expect(plan.rows[0].stintSec).toBeCloseTo(600, 6);
    expect(plan.rows[0].lapsInStint).toBe(2); // 600/240 = 2 tam tur
    const last = plan.rows[plan.rows.length - 1];
    expect(last.isLast).toBe(true);
    expect(last.endSec).toBeCloseTo(1200, 3);
  });

  it("ıslak hava lapSec'i çarpanla uzatır", () => {
    const plan = computePlan(baseState({ weatherLog: [{ t: 0, w: "wet" }] }), "race");
    expect(plan.lapSec).toBeCloseTo(240 * 1.13, 6);
  });

  it("multiclass lider bitiş modeli flagExtra üretir", () => {
    // lider turu 260 sn, yarış 3600 sn → ceil(3600/260)=14 → 14×260−3600 = 40
    const plan = computePlan(
      baseState({ multiclass: true, leaderLap: "4:20.00" }), "race");
    expect(plan.flagExtra).toBeCloseTo(40, 6);
  });

  it("tek sınıf (multiclass yok) flagExtra = 0 (tur süre tam bölerse)", () => {
    expect(computePlan(baseState(), "race").flagExtra).toBe(0);
  });
});
