import { describe, it, expect } from "vitest";
import { DEFAULT_STATE, computePlan } from "./engine.js";
import {
  safeParseState, grow, carriedTyre,
  applyUpTyre, applyQuickTyre, applyUpOvr, applyBumpLaps, applyClearLaps,
  applyUpStintLap, applyUpTyreCell, applyAssignDriver, applyUpPit,
  computeTyreInfo, computeDriverPlan, computeSlotStats, computeChartData,
  computeLiveInfo, buildTimeline,
} from "./state.js";

/* DEFAULT_STATE'ten türeyen temel durum — DERİN kopya (iç diziler paylaşılmasın,
   testler birbirini kirletmesin). */
const base = (over = {}) => Object.assign(structuredClone(DEFAULT_STATE), over);
const pitTyres = (st, i) => st.pits[i].tyres;

describe("safeParseState", () => {
  it("geçerli objeyi ayrıştırır", () => {
    expect(safeParseState('{"a":1}')).toEqual({ a: 1 });
  });
  it("bozuk JSON / obje olmayan / dizi → null", () => {
    expect(safeParseState("{bozuk")).toBeNull();
    expect(safeParseState("[1,2]")).toBeNull();
    expect(safeParseState("42")).toBeNull();
    expect(safeParseState("null")).toBeNull();
    expect(safeParseState("")).toBeNull();
  });
});

describe("grow", () => {
  it("dizileri n uzunluğuna uzatır, yeni pit varsayılanı", () => {
    const s = base({ pits: [{ fuel: true, lane: true, tyres: [0, 0, 0, 0] }],
      overrides: [""], tyreStints: [["", "", "", ""]], driverAssign: [""] });
    const g = grow(s, 4);
    expect(g.pits.length).toBe(4);
    expect(g.overrides.length).toBe(4);
    expect(g.tyreStints.length).toBe(4);
    expect(g.driverAssign.length).toBe(4);
    expect(g.pits[3]).toEqual({ fuel: true, lane: true, tyres: [false, false, false, false] });
  });
});

describe("applyUpTyre — köşe döngüsü 0→1→2→3→4→0", () => {
  it("limit boşken tam döngü", () => {
    let s = base({ tyreLimit: 26 });
    const seq = [];
    for (let k = 0; k < 5; k++) { s = applyUpTyre(s, 0, 0); seq.push(pitTyres(s, 0)[0]); }
    expect(seq).toEqual([1, 2, 3, 4, 0]);
  });
  it("limit doluyken yeni-kuru (1) atlanır → 2", () => {
    // tyreLimit=4, qual 1-4 zaten kullanılmış → yeni kuru yok
    const s = base({ tyreLimit: 4 });
    const r = applyUpTyre(s, 0, 0);
    expect(pitTyres(r, 0)[0]).toBe(2); // 0→(1 atlandı)→2
  });
  it("lastik tablosu senkronu: yeni kuru sonraki stinte yazılır", () => {
    const s = base({ tyreLimit: 26 });
    const r = applyUpTyre(s, 0, 0); // pit0 FL → yeni kuru
    expect(r.tyreStints[1][0]).toBe("5"); // 1-4 qual, ilk boş 5
  });
});

describe("applyQuickTyre", () => {
  it("new4: 4 taze numara atar", () => {
    const r = applyQuickTyre(base({ tyreLimit: 26 }), 1, "new4");
    expect(r.tyreStints[1]).toEqual(["5", "6", "7", "8"]);
  });
  it("clear ve carry", () => {
    const s = base({ tyreLimit: 26 });
    s.tyreStints[0] = ["5", "6", "7", "8"];
    expect(applyQuickTyre(s, 1, "carry").tyreStints[1]).toEqual(["5", "6", "7", "8"]);
    expect(applyQuickTyre(s, 1, "clear").tyreStints[1]).toEqual(["", "", "", ""]);
  });
  it("limit aşımında değişmeden döner", () => {
    const s = base({ tyreLimit: 4 }); // qual 1-4 dolu, yeni yer yok
    const r = applyQuickTyre(s, 1, "new4");
    expect(r).toBe(s); // aynı referans → değişmedi
  });
});

describe("tur/override reducer'ları", () => {
  it("bumpLaps: taban+delta, min 1, süre override temizler", () => {
    const s = base();
    s.overrides[0] = "0:30:00";
    const r = applyBumpLaps(s, 0, 8, 1);
    expect(r.lapOverrides[0]).toBe("9");
    expect(r.overrides[0]).toBe("");
    expect(applyBumpLaps(s, 0, 8, -20).lapOverrides[0]).toBe("1");
  });
  it("clearLaps: lap override'ı boşaltır", () => {
    const s = base({ lapOverrides: ["5", "6"] });
    expect(applyClearLaps(s, 0).lapOverrides[0]).toBe("");
  });
  it("upOvr: süre girilince lap override temizlenir", () => {
    const s = base({ lapOverrides: ["7"] });
    const r = applyUpOvr(s, 0, "0:30:00");
    expect(r.overrides[0]).toBe("0:30:00");
    expect(r.lapOverrides[0]).toBe("");
  });
  it("upStintLap: stinte özel tur süresi yazar", () => {
    expect(applyUpStintLap(base(), 2, "3:58.00").stintLaps[2]).toBe("3:58.00");
  });
});

describe("applyUpTyreCell", () => {
  it("Qual satırı (row -1) tyreQual'ı günceller", () => {
    expect(applyUpTyreCell(base(), -1, 0, "9").tyreQual[0]).toBe("9");
  });
  it("stint hücresi + pit bayrağı (yeni kuru = 1)", () => {
    const s = base({ tyreLimit: 26 });
    const r = applyUpTyreCell(s, 1, 0, "9"); // S2 FL = 9 (yeni)
    expect(r.tyreStints[1][0]).toBe("9");
    expect(r.pits[0].tyres[0]).toBe(1); // pit0 FL bayrağı: yeni kuru
  });
});

describe("applyAssignDriver", () => {
  it("atama yapar, kadroda yoksa ekler", () => {
    const s = base({ roster: ["Ali"], driverAssign: ["", ""] });
    const r = applyAssignDriver(s, 0, "Veli");
    expect(r.driverAssign[0]).toBe("Veli");
    expect(r.roster).toContain("Veli");
  });
  it("kadroda varsa tekrar eklemez", () => {
    const s = base({ roster: ["Ali"], driverAssign: ["", ""] });
    expect(applyAssignDriver(s, 0, "Ali").roster).toEqual(["Ali"]);
  });
});

describe("applyUpPit", () => {
  it("pit alanını patch'ler", () => {
    const r = applyUpPit(base(), 0, { fuel: false });
    expect(r.pits[0].fuel).toBe(false);
  });
});

describe("carriedTyre", () => {
  it("boş hücrede önceki stintten, yoksa Qual'dan taşınan", () => {
    const s = base();
    s.tyreStints[0] = ["3", "", "", ""];
    s.tyreStints[1] = ["", "", "", ""];
    expect(carriedTyre(s, 2, 0)).toBe("3");       // S1'den taşınır
    expect(carriedTyre(s, 2, 1)).toBe("2");       // hiç yok → Qual[1]
  });
});

describe("computeTyreInfo", () => {
  const st = base({ raceTime: "0:20:00", tyreLimit: 26 });
  const rp = computePlan(st, "race");
  it("kullanılan/kalan sayımı (yalnız Qual)", () => {
    const ti = computeTyreInfo(st, rp);
    expect(ti.used).toBe(4);              // qual 1-4
    expect(ti.available).toBe(22);        // 26 - 4
    expect(ti.conflicts).toEqual([]);
  });
  it("köşe kilidi ihlalini tespit eder", () => {
    const s2 = base({ raceTime: "0:20:00", tyreLimit: 26 });
    s2.tyreStints[0] = ["", "1", "", ""]; // "1" hem Qual col0 hem S1 col1 → çakışma
    const ti = computeTyreInfo(s2, computePlan(s2, "race"));
    expect(ti.conflicts).toContain("1");
  });
});

describe("computeDriverPlan", () => {
  it("stint→pilot toplam ve büyük toplam", () => {
    const st = base({ raceTime: "0:20:00", raceStartMs: 1_000_000,
      driverAssign: ["Ali", "Ali", "Ali", "Ali"] });
    const dp = computeDriverPlan(st, computePlan(st, "race"));
    expect(dp).not.toBeNull();
    expect(dp.totals.Ali.stints).toBeGreaterThan(0);
    expect(dp.grandMs).toBeGreaterThan(0);
  });
  it("raceStartMs NaN → null", () => {
    const st = base({ raceStartMs: NaN });
    expect(computeDriverPlan(st, computePlan(st, "race"))).toBeNull();
  });
});

describe("computeLiveInfo (enjekte edilen now)", () => {
  const st = base({ raceTime: "1:00:00", raceStartMs: 1_000_000 });
  const rp = computePlan(st, "race");
  const finish = 1_000_000 + rp.raceSec * 1000;
  it("yarış öncesi → pre", () => {
    expect(computeLiveInfo(st, rp, 500_000).status).toBe("pre");
  });
  it("yarış içinde → live, ilk stint", () => {
    const li = computeLiveInfo(st, rp, 1_000_000 + 60_000);
    expect(li.status).toBe("live");
    expect(li.phase).toBe("stint");
    expect(li.stintIdx).toBe(0);
  });
  it("yarış sonrası → done", () => {
    expect(computeLiveInfo(st, rp, finish + 1).status).toBe("done");
  });
  it("raceStartMs NaN → idle", () => {
    expect(computeLiveInfo(base({ raceStartMs: NaN }), rp, 0).status).toBe("idle");
  });
});

describe("computeSlotStats / computeChartData", () => {
  const st = base({ telemetry: { A: { laps: [
    { ms: 120000, use: true, fuel: 5, w: [1, 1, 1, 1] },
    { ms: 122000, use: true, fuel: 5, w: [1, 1, 1, 1] },
    { ms: 200000, use: false, fuel: 5, w: [1, 1, 1, 1] },
  ] }, B: null, C: null, D: null } });
  it("slotStats: dahil turlardan istatistik", () => {
    const s = computeSlotStats(st).A;
    expect(s.laps).toBe(2);
    expect(s.avgMs).toBe(121000);
    expect(s.bestMs).toBe(120000);
    expect(s.dropped).toBe(1);
  });
  it("chartData: tur bazlı saniye satırları", () => {
    const cd = computeChartData(st);
    expect(cd[0]).toEqual({ lap: 1, A: 120 });
    expect(cd[1]).toEqual({ lap: 2, A: 122 });
    expect(cd[2]).toEqual({ lap: 3 }); // 3. tur use:false → A yok
  });
});

describe("buildTimeline", () => {
  it("stint + pit segmentleri (son stintte pit yok)", () => {
    const plan = { raceSec: 1560, rows: [
      { idx: 1, stintSec: 1000, pitSec: 60 },
      { idx: 2, stintSec: 500, pitSec: 0, isLast: true },
    ] };
    const tl = buildTimeline(plan);
    expect(tl.length).toBe(3); // S1, pit, S2
    expect(tl[0].label).toBe("S1");
    expect(tl[1].cls).toBe("pit");
    expect(tl[2].label).toBe("S2");
  });
});
