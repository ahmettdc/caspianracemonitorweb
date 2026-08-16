import { describe, it, expect } from "vitest";
import {
  raceStatus, matchesFilters, sortByStart, groupByStatus,
  nextOfficialRace, deriveOptions, filtersActive, EMPTY_FILTERS,
  officialRaceToForm,
  groupByDay,
} from "./lmuSchedule";
import { classId } from "./constants";

/* Sabit "now": 2026-08-13T09:00:00Z. Yarışlar bu ankere göre kurulur. */
const NOW = Date.parse("2026-08-13T09:00:00Z");
const H = 3600 * 1000;
const mk = (over) => ({
  id: "x", kind: "daily", name: "Race", startMs: NOW + H, lenSec: 1200,
  live: false, sr: "B0", srRank: "Bronze", trackId: "spa", trackRaw: "",
  classes: ["GT3"], lenLabel: "20m", ...over,
});

/* Gerçekçi karışık liste: geçmiş, canlı, yaklaşan; farklı seri/sınıf/pist. */
const RACES = [
  mk({ id: "past-1", name: "Past A", kind: "weekly", startMs: NOW - 5 * H, trackId: "monza", classes: ["LMP2"], srRank: "Silver" }),
  mk({ id: "live-1", name: "Live A", kind: "daily", startMs: NOW - 10 * 60000, lenSec: 1800, trackId: "spa", classes: ["GT3"], srRank: "Bronze" }),
  mk({ id: "up-2", name: "Up Later", kind: "special", startMs: NOW + 6 * H, trackId: "lemans", classes: ["HY", "GT3"], srRank: "Gold" }),
  mk({ id: "up-1", name: "Up Soon", kind: "daily", startMs: NOW + 2 * H, trackId: "bahrain", classes: ["LMP3"], srRank: "Bronze" }),
  mk({ id: "past-2", name: "Past B", kind: "daily", startMs: NOW - 2 * H, trackId: "spa", classes: ["GT3"], srRank: "Bronze" }),
];

describe("raceStatus — zamana göre hesaplanır (senaryo 12)", () => {
  it("upcoming / live / completed doğru ayrışır", () => {
    expect(raceStatus(mk({ startMs: NOW + H }), NOW)).toBe("upcoming");
    expect(raceStatus(mk({ startMs: NOW - 5 * 60000, lenSec: 1800 }), NOW)).toBe("live");
    expect(raceStatus(mk({ startMs: NOW - 5 * H, lenSec: 1200 }), NOW)).toBe("completed");
  });
  it("now ilerledikçe aynı yarış upcoming→live→completed olur", () => {
    const r = mk({ startMs: NOW, lenSec: 1200 }); // 20 dk
    expect(raceStatus(r, NOW - 60000)).toBe("upcoming");
    expect(raceStatus(r, NOW + 5 * 60000)).toBe("live");
    expect(raceStatus(r, NOW + 40 * 60000)).toBe("completed");
  });
  it("startMs yoksa güvenli fallback (kart kırılmaz)", () => {
    expect(raceStatus(mk({ startMs: null }), NOW)).toBe("upcoming");
  });
});

describe("sortByStart — kronolojik + deterministik tiebreak (senaryo 1)", () => {
  it("asc: yaklaşan yarıştan başlar", () => {
    const s = sortByStart(RACES, "asc").map((r) => r.id);
    expect(s).toEqual(["past-1", "past-2", "live-1", "up-1", "up-2"]);
  });
  it("aynı startMs → id ile deterministik", () => {
    const same = [mk({ id: "b", startMs: NOW }), mk({ id: "a", startMs: NOW })];
    expect(sortByStart(same, "asc").map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("filtreler (senaryo 2,4,5)", () => {
  it("Seri (kind) filtresi", () => {
    const only = RACES.filter((r) => matchesFilters(r, { series: "daily" }, NOW));
    expect(only.map((r) => r.id).sort()).toEqual(["live-1", "past-2", "up-1"]);
  });
  it("Status filtresi", () => {
    const up = RACES.filter((r) => matchesFilters(r, { status: "upcoming" }, NOW));
    expect(up.map((r) => r.id).sort()).toEqual(["up-1", "up-2"]);
  });
  it("Çoklu filtre AND (Seri=daily + Status=upcoming + Sınıf=LMP3)", () => {
    const r = RACES.filter((x) => matchesFilters(x, { series: "daily", status: "upcoming", cls: "LMP3" }, NOW));
    expect(r.map((x) => x.id)).toEqual(["up-1"]);
  });
  it("Pist ve SR filtreleri", () => {
    expect(RACES.filter((r) => matchesFilters(r, { track: "spa" }, NOW)).map((r) => r.id).sort())
      .toEqual(["live-1", "past-2"]);
    expect(RACES.filter((r) => matchesFilters(r, { sr: "Gold" }, NOW)).map((r) => r.id)).toEqual(["up-2"]);
  });
});

describe("arama + filtre birlikte (senaryo 6)", () => {
  it("metin araması ada/piste/seriye göre eşleşir", () => {
    expect(RACES.filter((r) => matchesFilters(r, { q: "monza" }, NOW)).map((r) => r.id)).toEqual(["past-1"]);
    expect(RACES.filter((r) => matchesFilters(r, { q: "up" }, NOW)).map((r) => r.id).sort()).toEqual(["up-1", "up-2"]);
  });
  it("arama + status AND", () => {
    const r = RACES.filter((x) => matchesFilters(x, { q: "spa", status: "completed" }, NOW));
    expect(r.map((x) => x.id)).toEqual(["past-2"]);
  });
});

describe("Clear Filters (senaryo 7) + empty state (senaryo 8)", () => {
  it("filtersActive & EMPTY_FILTERS", () => {
    expect(filtersActive(EMPTY_FILTERS)).toBe(false);
    expect(filtersActive({ ...EMPTY_FILTERS, series: "weekly" })).toBe(true);
    expect(filtersActive({ ...EMPTY_FILTERS, q: "x" })).toBe(true);
  });
  it("eşleşme yoksa matchedCount 0 (empty state tetikler)", () => {
    const g = groupByStatus(RACES, { series: "weekly", status: "live" }, NOW);
    expect(g.matchedCount).toBe(0);
    expect(g.live).toEqual([]); expect(g.upcoming).toEqual([]); expect(g.completed).toEqual([]);
  });
});

describe("groupByStatus + nextOfficialRace + deriveOptions", () => {
  it("gruplar doğru + completed ters kronolojik", () => {
    const g = groupByStatus(RACES, {}, NOW);
    expect(g.live.map((r) => r.id)).toEqual(["live-1"]);
    expect(g.upcoming.map((r) => r.id)).toEqual(["up-1", "up-2"]);
    expect(g.completed.map((r) => r.id)).toEqual(["past-2", "past-1"]); // en yeni önce
  });
  it("nextOfficialRace = en yakın yaklaşan", () => {
    expect(nextOfficialRace(RACES, NOW).id).toBe("up-1");
  });
  it("deriveOptions yalnız veride bulunanları döndürür (season YOK)", () => {
    const o = deriveOptions(RACES);
    expect(o.series.sort()).toEqual(["daily", "special", "weekly"]);
    expect(o.classes.sort()).toEqual(["GT3", "HY", "LMP2", "LMP3"]);
    expect(o.srRanks.sort()).toEqual(["Bronze", "Gold", "Silver"]);
    expect(o).not.toHaveProperty("season");
  });
});

describe("officialRaceToForm (Resmi Yarış → ön ayar, v1.7.3)", () => {
  it("pist/süre/ad prefill; belirli araç YOK (carId boş); rid null", () => {
    const r = mk({ name: "Le Mans 24h", trackId: "lemans", startMs: 1234567890000,
      lenSec: 8640, classes: ["Hypercar"] });
    const f = officialRaceToForm(r, { seasonId: "s1", classId, qualMin: 20 });
    expect(f.rid).toBe(null);
    expect(f.name).toBe("Le Mans 24h");
    expect(f.trackId).toBe("lemans");
    expect(f.raceTime).toBe("2:24:00");        // 8640 sn → H:MM:SS
    expect(f.carClass).toBe("hypercar");        // classId normalizasyonu
    expect(f.carId).toBe("");                   // takvimde araç yok → kullanıcı seçer
    expect(f.seasonId).toBe("s1");
    expect(f.round).toBe("");
  });
  it("yarış başı = seans + sıralama + 5 dk formasyon (14:00 seans, 20 dk sıralama → 14:25)", () => {
    const start = Date.parse("2026-08-18T14:00:00Z");
    const r = mk({ startMs: start, classes: ["GT3"] });
    const f = officialRaceToForm(r, { classId, qualMin: 20 });
    expect(f.sessionStartMs).toBe(start);       // resmi seans başı korunur
    expect(f.qualMin).toBe(20);
    expect(f.startsAt).toBe(start + 25 * 60000); // 20 + 5 = 25 dk → 14:25
  });
  it("takvim detayından gerçek sıralama süresi (qualSec) kullanılır — tahmin değil", () => {
    const start = Date.parse("2026-08-18T14:00:00Z");
    const r = mk({ startMs: start, qualSec: 480 });   // siteden 8 dk
    const f = officialRaceToForm(r, { classId });
    expect(f.qualMin).toBe(8);                          // 480 sn → 8 dk (varsayılan 15 değil)
    expect(f.startsAt).toBe(start + 13 * 60000);        // 8 + 5 = 13 dk → 14:13
  });
  it("elle qualMin, takvim qualSec'ini geçersiz kılar (öncelik)", () => {
    const r = mk({ qualSec: 480 });
    expect(officialRaceToForm(r, { classId, qualMin: 20 }).qualMin).toBe(20);
  });
  it("lastik seti sınırı (tyreSets) forma taşınır; yoksa null", () => {
    expect(officialRaceToForm(mk({ tyreSets: 8 }), { classId }).tyreSets).toBe(8);
    expect(officialRaceToForm(mk({}), { classId }).tyreSets).toBe(null);
    expect(officialRaceToForm(mk({ tyreSets: 0 }), { classId }).tyreSets).toBe(null);
  });
  it("qualSec yoksa son çare tahmine düşer (offset yine uygulanır)", () => {
    const start = Date.parse("2026-08-18T14:00:00Z");
    const f = officialRaceToForm(mk({ startMs: start }), { classId });   // qualSec yok
    expect(f.qualMin).toBeGreaterThan(0);
    expect(f.startsAt).toBe(start + (f.qualMin + 5) * 60000);
  });
  it("çok sınıflı: ilk EŞLEŞEN sınıf ön-seçilir", () => {
    const r = mk({ classes: ["Hypercar", "LMGT3"] });
    expect(officialRaceToForm(r, { classId }).carClass).toBe("hypercar");
  });
  it("classId fn verilmezse ham sınıf metnini olduğu gibi kullanır (yedek)", () => {
    expect(officialRaceToForm(mk({ classes: ["gt3"] })).carClass).toBe("gt3");
  });
  it("süre yok (special/championship) → fallbackRaceTime", () => {
    const r = mk({ lenSec: null, classes: ["GT3"] });
    expect(officialRaceToForm(r, { fallbackRaceTime: "6:00:00", classId }).raceTime)
      .toBe("6:00:00");
  });
  it("eşleşmeyen/boş sınıf → hypercar varsayılanı; trackId eşleşmemişse boş kalır", () => {
    const r = mk({ classes: [], trackId: "" });
    const f = officialRaceToForm(r, { classId });
    expect(f.carClass).toBe("hypercar");
    expect(f.trackId).toBe("");
  });
  it("startMs yoksa startsAt bir zaman damgası olur (0 değil)", () => {
    const f = officialRaceToForm(mk({ startMs: null }), { classId });
    expect(f.startsAt).toBeGreaterThan(0);
  });
});

/* v2.0 — README §13: liste duruma göre değil GÜNE GÖRE gruplanır
   (Bugün / Yarın / tarih). groupByStatus özet sayaçları için duruyor. */
describe("groupByDay (v2.0)", () => {
  const D = (iso) => new Date(iso).getTime();
  const NOW = D("2026-08-16T12:00:00");
  const mk = (id, iso, dur = 3600000) => ({
    id, startMs: D(iso), endMs: D(iso) + dur, kind: "Daily", classes: ["GT3"],
  });

  it("aynı güne düşen yarışlar tek grupta toplanır", () => {
    const g = groupByDay([mk("a", "2026-08-16T14:00:00"), mk("b", "2026-08-16T18:00:00")],
      {}, NOW, null);
    expect(g).toHaveLength(1);
    expect(g[0].races.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("bugün ve sonrası önce, geçmiş günler en yeniden eskiye sonra", () => {
    const g = groupByDay([
      mk("dun", "2026-08-15T10:00:00"), mk("yarin", "2026-08-17T10:00:00"),
      mk("bugun", "2026-08-16T20:00:00"), mk("oncekiGun", "2026-08-14T10:00:00"),
    ], {}, NOW, null);
    expect(g.map((d) => d.races[0].id)).toEqual(["bugun", "yarin", "dun", "oncekiGun"]);
  });

  it("gün içinde canlı yarış başa gelir, sonra yaklaşan, sonra biten", () => {
    const g = groupByDay([
      mk("biten", "2026-08-16T08:00:00"),
      mk("yaklasan", "2026-08-16T22:00:00"),
      mk("canli", "2026-08-16T11:30:00", 3 * 3600000),
    ], {}, NOW, null);
    expect(g[0].races.map((r) => r.id)).toEqual(["canli", "yaklasan", "biten"]);
  });

  it("başlangıcı olmayan kayıt gruplanmaz (çökertmez)", () => {
    const g = groupByDay([{ id: "x" }, mk("a", "2026-08-16T14:00:00")], {}, NOW, null);
    expect(g).toHaveLength(1);
    expect(g[0].races.map((r) => r.id)).toEqual(["a"]);
  });

  it("boş liste boş dizi döner", () => {
    expect(groupByDay([], {}, NOW, null)).toEqual([]);
    expect(groupByDay(null, {}, NOW, null)).toEqual([]);
  });
});
