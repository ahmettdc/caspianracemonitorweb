import { describe, it, expect } from "vitest";
import { DEFAULT_STATE, computePlan, tyState } from "./engine.js";
import {
  safeParseState, grow, carriedTyre,
  applyUpTyre, applyQuickTyre, applyUpOvr, applyBumpLaps, applyClearLaps,
  applyUpStintLap, applyUpTyreCell, applyAssignDriver, applyUpPit,
  applyClearTyres, pitTyreFlag,
  computeTyreInfo, computeDriverPlan, computeSlotStats, computeChartData,
  computeLiveInfo, buildTimeline, apply105Rule,
  applyMarkPit, applyUnmarkPit, applyResetPits,
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

describe("applyUpTyre — köşe döngüsü (fiziksel anlamsız durumlar atlanır)", () => {
  it("tam döngü: köşe geçmişinde takılabilir eski kuru ve farklı Qual varken", () => {
    // S1=5,6,7,8 · S2 FL=9 → pit(S3 öncesi): yeni(1) → Qual(2) → W(3) → eski 5(4) → taşı(0)
    const ts = Array.from({ length: 14 }, () => ["", "", "", ""]);
    ts[0] = ["5", "6", "7", "8"]; ts[1] = ["9", "", "", ""];
    let s = base({ tyreLimit: 26, tyreStints: ts });
    const seq = [];
    for (let k = 0; k < 5; k++) { s = applyUpTyre(s, 1, 0); seq.push(pitTyres(s, 1)[0]); }
    expect(seq).toEqual([1, 2, 3, 4, 0]);
  });
  it("S1 boşken döngü: 1 → 2 → 3 → 0 (ayrı eski kuru yok → 4 atlanır)", () => {
    /* Qual'ı geri takmak da bir pit işlemidir (oyunda süre kaybettirir —
       kullanıcı doğrulaması v1.4.60); yalnız köşede AYRI bir eski kuru
       bulunmadığı için 4 adayı atlanır (Qual numarası 2 olarak sınıflanır). */
    let s = base({ tyreLimit: 26 });
    const seq = [];
    for (let k = 0; k < 4; k++) { s = applyUpTyre(s, 0, 0); seq.push(pitTyres(s, 0)[0]); }
    expect(seq).toEqual([1, 2, 3, 0]);
  });
  it("limit doluyken yeni-kuru (1) atlanır → 2", () => {
    const s = base({ tyreLimit: 4 });   // qual 1-4 kullanılmış, S1 boş
    const r = applyUpTyre(s, 0, 0);
    expect(pitTyres(r, 0)[0]).toBe(2);  // 0→(1 limit)→2 Qual tak
  });
  it("lastik tablosu senkronu: yeni kuru sonraki stinte yazılır", () => {
    const s = base({ tyreLimit: 26 });
    const r = applyUpTyre(s, 0, 0); // pit0 FL → yeni kuru
    expect(r.tyreStints[1][0]).toBe("5"); // 1-4 qual, ilk boş 5
  });
});

describe("pit lastik bayrağı — tablodan türetme (v1.4.59/60)", () => {
  it("taşınan lastiği ELLE seçmek pit işlemidir (oyunda süre kaybettirir)", () => {
    /* S1 boş → Qual 1 taşınıyor; S2 FL'ye elle '1' yazmak = Qual lastiğini pitte
       geri takmak → oyunda gerçek süre kaybı (kullanıcı doğrulaması v1.4.60).
       Değişim istenmiyorsa hücre boş bırakılır. */
    const r = applyUpTyreCell(base(), 1, 0, "1");
    expect(tyState(pitTyres(r, 0)[0])).toBe(2);
    expect(computePlan(r, "race").rows[0].tyreCount).toBe(1);
  });
  it("aradaki hücre silinince SONRAKİ pit bayrağı tazelenir", () => {
    let s = base();
    s = applyUpTyreCell(s, 1, 0, "5");
    s = applyUpTyreCell(s, 2, 0, "5");            // aynı lastik devam → 0
    expect(tyState(pitTyres(s, 1)[0])).toBe(0);
    s = applyUpTyreCell(s, 1, 0, "");             // S2 temizlendi
    // S3'teki 5 artık gerçek bir değişim (ilk kez takılıyor) — eskiden 0 kalıyordu
    expect(tyState(pitTyres(s, 1)[0])).toBe(1);
  });
  it("applyClearTyres pit bayraklarını da sıfırlar", () => {
    let s = applyQuickTyre(base(), 2, "new4");
    expect(pitTyres(s, 1).some((v) => tyState(v) > 0)).toBe(true);
    s = applyClearTyres(s);
    expect(pitTyres(s, 1).every((v) => tyState(v) === 0)).toBe(true);
    expect(computePlan(s, "race").rows[1].tyreCount).toBe(0);
  });
  it("pitTyreFlag sınıflaması: taşı/W/Qual/eski/yeni", () => {
    const ts = Array.from({ length: 14 }, () => ["", "", "", ""]);
    ts[0] = ["5", "6", "7", "8"];
    const s = base({ tyreStints: ts });
    expect(pitTyreFlag(s, 1, 0, "")).toBe(0);     // boş = taşı
    expect(pitTyreFlag(s, 1, 0, "5")).toBe(0);    // zaten araçta
    expect(pitTyreFlag(s, 1, 0, "W")).toBe(3);
    expect(pitTyreFlag(s, 1, 0, "1")).toBe(2);    // o köşenin Qual'ı
    expect(pitTyreFlag(s, 1, 0, "2")).toBe(4);    // başka köşenin Qual'ı = eski
    expect(pitTyreFlag(s, 1, 0, "9")).toBe(1);    // hiç görülmemiş = yeni
  });
  it("pitTyreFlag: önceki köşe wet iken tekrar wet = 3 (sınırsız, regresyon)", () => {
    const ts = Array.from({ length: 14 }, () => ["", "", "", ""]);
    ts[0] = ["W", "W", "W", "W"];  // önceki stint pit'i wet takmış
    const s = base({ tyreStints: ts });
    // Eskiden k === prevRaw ("W"==="W") önce çalışıp 0 (taşı) dönüyordu → wet seçilemiyordu
    expect(pitTyreFlag(s, 1, 0, "W")).toBe(3);    // wet HER ZAMAN gerçek işlem
    // Kuru davranış korunur: aynı kuru numara hâlâ taşı
    ts[1] = ["5", "5", "5", "5"];
    const s2 = base({ tyreStints: ts });
    expect(pitTyreFlag(s2, 2, 0, "5")).toBe(0);   // aynı kuru numara = taşı
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

  /* REGRESYON (v1.4.53): gerçek pitler plandan ERKEN işaretlenirse zincir bayraktan
     önce tükenir. Eskiden yedek `stintStartMs` yarış başlangıcı kalıyor, son stintte
     "stint süresi" TÜM YARIŞ gibi görünüyordu. */
  it("plandan erken pitlerde son stint yarış başlangıcından başlamaz", () => {
    const start = 1_000_000;
    const long = base({ raceTime: "2:24:00", raceStartMs: start });
    const rpL = computePlan(long, "race");
    expect(rpL.rows.length).toBeGreaterThan(2);   // çok stintli kurgu
    // her stinti plandan ~5 dk erken bitir
    const actualPits = rpL.rows.slice(0, -1).map((_, i) =>
      start + (i + 1) * (rpL.rows[0].stintSec - 300) * 1000);
    const st2 = base({ raceTime: "2:24:00", raceStartMs: start, actualPits });
    const rp2 = computePlan(st2, "race");
    const chainEnd = actualPits[actualPits.length - 1]
      + rp2.rows[actualPits.length - 1].pitSec * 1000
      + rp2.rows[actualPits.length].stintSec * 1000;
    const now = chainEnd + 120_000;              // zincir bittikten 2 dk sonra
    const li = computeLiveInfo(st2, rp2, now);
    expect(li.status).toBe("live");
    expect(li.stintIdx).toBe(rp2.rows.length - 1);
    expect(li.stintStartMs).toBeGreaterThan(start);       // eskiden === start
    expect(now - li.stintStartMs).toBeLessThan(li.elapsed); // stint süresi ≠ yarış süresi
  });
});

/* ============================================================
   REGRESYON — gerçek pit işaretleme (v1.4.53)
   ============================================================ */
describe("applyMarkPit / applyUnmarkPit / applyResetPits", () => {
  const start = 1_000_000;
  const st = base({ raceTime: "1:00:00", raceStartMs: start });
  const liveAt = (s, now) => computeLiveInfo(s, computePlan(s, "race"), now);

  it("stint fazında: gerçek pit + otomatik süre override'ı yazar", () => {
    const now = start + 20 * 60_000;
    const patch = applyMarkPit(st, liveAt(st, now), now);
    expect(patch.actualPits[0]).toBe(now);
    expect(patch.overrides[0]).toBe("00:20:00");
    expect(patch.autoOvr[0]).toBe(true);
  });

  it("PİT FAZINDA ikinci basış YOK SAYILIR (eskiden pit yolu süresi stint'e eklenirdi)", () => {
    const t1 = start + 20 * 60_000;
    const marked = { ...st, ...applyMarkPit(st, liveAt(st, t1), t1) };
    const t2 = t1 + 35_000;                       // 35 sn sonra, araç pit yolunda
    const li2 = liveAt(marked, t2);
    expect(li2.phase).toBe("pit");
    expect(li2.stintIdx).toBe(0);
    expect(applyMarkPit(marked, li2, t2)).toBeNull();
    expect(marked.overrides[0]).toBe("00:20:00"); // bozulmadı
  });

  it("canlı değilken null döner", () => {
    expect(applyMarkPit(st, { status: "pre", phase: "stint", stintIdx: 0 }, start)).toBeNull();
    expect(applyMarkPit(st, null, start)).toBeNull();
  });

  it("süre override'ı yazılınca bayat tur override'ı temizlenir (applyUpOvr ile aynı)", () => {
    const lapOverrides = Array(14).fill(""); lapOverrides[0] = "7";
    const s = { ...st, lapOverrides };
    const now = start + 20 * 60_000;
    const patch = applyMarkPit(s, liveAt(s, now), now);
    expect(patch.lapOverrides[0]).toBe("");
  });

  it("applyUnmarkPit son pit'i ve yalnız otomatik override'ı geri alır", () => {
    const t1 = start + 20 * 60_000;
    const marked = { ...st, ...applyMarkPit(st, liveAt(st, t1), t1) };
    const patch = applyUnmarkPit(marked);
    expect(patch.actualPits.length).toBe(0);
    expect(patch.overrides[0]).toBe("");
    expect(patch.autoOvr[0]).toBe(false);
    expect(applyUnmarkPit(st)).toBeNull();       // işaretli pit yok
  });

  it("applyResetPits elle girilen override'ları KORUR", () => {
    const overrides = [...st.overrides]; overrides[0] = "0:30:00"; overrides[1] = "0:25:00";
    const autoOvr = [false, true];
    const patch = applyResetPits({ ...st, overrides, autoOvr, pitRepairs: [30, 0, 15] });
    expect(patch.actualPits).toEqual([]);
    expect(patch.overrides[0]).toBe("0:30:00");  // elle → korunur
    expect(patch.overrides[1]).toBe("");         // otomatik → silinir
    expect(patch.pitRepairs).toBeUndefined();    // elle girilen tamir süreleri korunur (patch'te yok)
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

describe("apply105Rule — kısmi/freak tur 'en iyi' sayılmaz", () => {
  it("kısmi 00:17 tur en hızlı sayılmaz; gerçek turlar tikli kalır", () => {
    // gerçek bug senaryosu: 2:21 turlar + yarım kalmış 17 sn'lik kısmi tur
    const laps = [
      { ms: 141100, use: true },
      { ms: 141900, use: true },
      { ms: 142500, use: true },
      { ms: 17000, use: true, partial: true },
    ];
    const out = apply105Rule(laps);
    expect(out[0].use).toBe(true);   // 2:21.1 (en hızlı) kalır
    expect(out[1].use).toBe(true);   // %105 içinde
    expect(out[2].use).toBe(true);
    // kısmi tur "en iyi" olmadığı için gerçek turlar elenmedi
  });
  it("freak-kısa (medyanın <%50) non-partial tur da en-iyi olamaz", () => {
    const laps = [
      { ms: 141000, use: true },
      { ms: 142000, use: true },
      { ms: 143000, use: true },
      { ms: 30000, use: true },   // glitch: medyanın <%50, kısmi değil
    ];
    const out = apply105Rule(laps);
    expect(out[0].use).toBe(true);
    expect(out[1].use).toBe(true);
    expect(out[2].use).toBe(true);
  });
  it("gerçek yavaş tur (trafik) %105'i aşınca elenir", () => {
    const laps = [
      { ms: 120000, use: true },
      { ms: 121000, use: true },
      { ms: 140000, use: true },   // en iyinin %105'i (126000) üstünde
    ];
    const out = apply105Rule(laps);
    expect(out[0].use).toBe(true);
    expect(out[1].use).toBe(true);
    expect(out[2].use).toBe(false);
  });
  it("2'den az aday → değişmez; CSV turları (partial yok) eski davranış", () => {
    expect(apply105Rule([{ ms: 120000, use: true }])).toEqual([{ ms: 120000, use: true }]);
    const csv = [{ ms: 120000, use: true }, { ms: 200000, use: true }];
    expect(apply105Rule(csv)[1].use).toBe(false);   // partial alanı yok → normal eleme
  });
});

describe("computeSlotStats — bestMs kısmi turu yok sayar", () => {
  it("kısmi tur elle tiklenmiş olsa da en iyi/lim105 gerçek turdan hesaplanır", () => {
    const st = base({ telemetry: { A: { laps: [
      { ms: 141100, use: true, w: [1, 1, 1, 1] },
      { ms: 142000, use: true, w: [1, 1, 1, 1] },
      { ms: 17000, use: true, partial: true, w: [1, 1, 1, 1] },   // elle açık kısmi
    ] }, B: null, C: null, D: null } });
    const s = computeSlotStats(st).A;
    expect(s.bestMs).toBe(141100);          // 17000 (kısmi) değil
    expect(s.lim105).toBeCloseTo(141100 * 1.05, 3);
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

/* v2.0 — set envanteri rozeti: kullanılmış bir set için allowedIn YALNIZ ilk
   takıldığı sütunda true döner (kilitli köşe). TyreTab envanter çipi bunu
   kullanıyor; davranış burada kilitleniyor.
   NOT: DEFAULT_STATE.tyreQual = ["1","2","3","4"] — Qual satırı da köşe kilidi
   yaratır. Testler bu yüzden Qual satırını boşaltıp izole ölçüyor. */
describe("computeTyreInfo — kilitli köşe (set envanteri, v2.0)", () => {
  const plan2 = { rows: [{}, {}] };
  const mk = (stints) => base({ tyreQual: ["", "", "", ""], tyreStints: stints });

  it("bir sütunda kullanılan set yalnız o sütunda izinli", () => {
    const info = computeTyreInfo(mk([["3", "", "", ""], ["", "", "", ""]]), plan2);
    expect([0, 1, 2, 3].filter((ci) => info.allowedIn("3", ci))).toEqual([0]);
  });
  it("hiç kullanılmamış set her sütunda izinli (rozet gösterilmez)", () => {
    const info = computeTyreInfo(mk([["", "", "", ""], ["", "", "", ""]]), plan2);
    expect([0, 1, 2, 3].filter((ci) => info.allowedIn("9", ci))).toEqual([0, 1, 2, 3]);
  });
  it("iki farklı köşede kullanılan set hiçbir sütunda izinli değil (ihlal)", () => {
    const info = computeTyreInfo(mk([["5", "5", "", ""], ["", "", "", ""]]), plan2);
    expect([0, 1, 2, 3].filter((ci) => info.allowedIn("5", ci))).toEqual([]);
    expect(info.conflicts).toContain("5");
  });
  it("Qual satırı da köşe kilidi yaratır (varsayılan tyreQual ile)", () => {
    /* Varsayılanda "3" Qual'da RL (sütun 2) → aynı seti FL'ye koymak ihlal. */
    const info = computeTyreInfo(
      base({ tyreStints: [["3", "", "", ""], ["", "", "", ""]] }), plan2);
    expect(info.conflicts).toContain("3");
  });
  it("wet (W) limitten bağımsız — used (farklı KURU set) sayımına girmez", () => {
    const info = computeTyreInfo(mk([["W", "W", "W", "W"], ["", "", "", ""]]), plan2);
    expect(info.used).toBe(0);
    expect(info.counts.W).toBe(4);
    expect(info.conflicts).toEqual([]);
  });
});
