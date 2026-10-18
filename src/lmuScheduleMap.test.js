import { describe, it, expect } from "vitest";
import {
  mapTrackId, mapClassId, mapClasses, lenLabel, trackFromRound,
  raceFromEvent, raceFromChampEvent, buildSchedule,
} from "./lmuScheduleMap.js";

describe("mapTrackId", () => {
  it("lmuportal track_friendly → app id", () => {
    expect(mapTrackId("Silverstone")).toBe("silverstone");
    expect(mapTrackId("Portimão")).toBe("portimao");
    expect(mapTrackId("Bahrain")).toBe("bahrain");
    expect(mapTrackId("Interlagos")).toBe("interlagos");
  });
  it("bilinmeyen → ''", () => expect(mapTrackId("Nürburgring")).toBe(""));
});

describe("mapClassId / mapClasses", () => {
  it("sınıf eşlemesi + dedupe, bilinmeyen atılır", () => {
    expect(mapClassId("Hypercar")).toBe("hypercar");
    expect(mapClassId("LMGT3")).toBe("gt3");
    expect(mapClassId("LMP2_ELMS")).toBe("lmp2");
    expect(mapClasses(["Hypercar", "LMGT3", "LMP2_ELMS", "LMP3", "???"]))
      .toEqual(["hypercar", "gt3", "lmp2", "lmp3"]);
  });
});

describe("lenLabel", () => {
  it("dakika → kısa etiket", () => {
    expect(lenLabel(240)).toBe("4h");
    expect(lenLabel(60)).toBe("1h");
    expect(lenLabel(90)).toBe("1h30m");
    expect(lenLabel(40)).toBe("40m");
    expect(lenLabel(0)).toBe("");
  });
});

describe("trackFromRound", () => {
  it("'Round N: Pist' → Pist", () => {
    expect(trackFromRound("Round 2: Interlagos")).toBe("Interlagos");
    expect(trackFromRound("Paul Ricard")).toBe("Paul Ricard");
  });
});

describe("raceFromEvent", () => {
  const ev = {
    event_id: "evt-1",
    race_starts_at: "2026-10-18T11:25:00+00:00",
    series_name: "WEC-Xperience",
    race_series: {
      type: "daily", setup: "Open", track_friendly: "Silverstone",
      car_classes: ["Hypercar", "LMGT3"], sr_requirement: "Gold",
      race_duration_minutes: 60, qualifying_duration_minutes: 9,
      practice_duration_minutes: 3, tyre_allowance: 10, fuel_multiplier: 1,
    },
  };
  const r = raceFromEvent(ev);
  it("alanları doğru eşler", () => {
    expect(r.id).toBe("evt-1");
    expect(r.kind).toBe("daily");
    expect(r.name).toBe("WEC-Xperience");
    expect(r.trackId).toBe("silverstone");
    expect(r.trackRaw).toBe("Silverstone");
    expect(r.classes).toEqual(["hypercar", "gt3"]);
    expect(r.sr).toBe("Gold");
    expect(r.srRank).toBe("Gold");
    expect(r.lenSec).toBe(3600);
    expect(r.lenLabel).toBe("1h");
    expect(r.qualSec).toBe(540);
    expect(r.tyreSets).toBe(10);
    expect(r.live).toBe(false);
    expect(r.url).toBe("https://lmuportal.com/upcoming");
  });
  it("weekend paneli yalnız var olan alanları taşır", () => {
    expect(r.weekend).toEqual({ practiceSec: 180, qualSec: 540, raceSec: 3600, tyreSets: 10, fixedSetup: false, fuel: 1 });
  });
  it("tarihsiz kayıt → null (§1 uydurma yok)", () => {
    expect(raceFromEvent({ ...ev, race_starts_at: null })).toBeNull();
  });
});

describe("raceFromChampEvent", () => {
  const ev = {
    event_id: "champ-1",
    race_starts_at: "2026-10-18T08:16:00+00:00",
    round_name: "Round 2: Interlagos",
    championship_series: {
      type: "championship", setup: "open", series_name: "Americas Endurance Series",
      car_classes: ["Hypercar", "LMGT3"], sr_requirement: "Platinum 1 SR",
      race_duration_minutes: 120, qualifying_duration_minutes: 12,
      practice_duration_minutes: 3, tyres_available: 10,
    },
  };
  const r = raceFromChampEvent(ev);
  it("pist round_name'den; kind=championship", () => {
    expect(r.kind).toBe("championship");
    expect(r.name).toBe("Americas Endurance Series");
    expect(r.trackRaw).toBe("Interlagos");
    expect(r.trackId).toBe("interlagos");
    expect(r.tyreSets).toBe(10);
    expect(r.lenLabel).toBe("2h");
    expect(r.url).toBe("https://lmuportal.com/championships");
  });
});

describe("buildSchedule", () => {
  it("birleştirir, startMs'e göre sıralar, id ile dedupe eder, null eler", () => {
    const events = [
      { event_id: "a", race_starts_at: "2026-10-18T14:00:00Z", series_name: "Geç", race_series: { type: "daily", track_friendly: "Spa", car_classes: ["GT3"] } },
      { event_id: "b", race_starts_at: "2026-10-18T10:00:00Z", series_name: "Erken", race_series: { type: "daily", track_friendly: "Monza", car_classes: ["Hypercar"] } },
      { event_id: "a", race_starts_at: "2026-10-18T14:00:00Z", series_name: "Kopya", race_series: { type: "daily", track_friendly: "Spa", car_classes: ["GT3"] } },
      { event_id: "x", race_starts_at: "çöp", series_name: "Tarihsiz", race_series: { type: "daily", track_friendly: "Fuji" } },
    ];
    const champEvents = [
      { event_id: "c", race_starts_at: "2026-10-18T08:00:00Z", round_name: "Round 1: Imola", championship_series: { series_name: "Şampiyona", car_classes: ["LMP2"] } },
    ];
    const races = buildSchedule({ events, champEvents });
    expect(races.map((r) => r.id)).toEqual(["c", "b", "a"]);  // 08:00, 10:00, 14:00
    expect(races.find((r) => r.id === "a").name).toBe("Geç");  // ilk kazanır (kopya elendi)
    expect(races.some((r) => r.id === "x")).toBe(false);        // tarihsiz elendi
  });
  it("boş girdi → []", () => expect(buildSchedule({})).toEqual([]));
});
