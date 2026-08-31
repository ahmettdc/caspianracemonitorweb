import { describe, it, expect } from "vitest";
import { tyreEvents, lastLap, buildLedger, ledgerSummary } from "./tyreLedger";

describe("tyreEvents", () => {
  it("tur sırasına dizer, adet+hamur ayrıştırır", () => {
    expect(tyreEvents({ 30: "4|Medium", 12: "2|Medium" }))
      .toEqual([{ lap: 12, n: 2, comp: "Medium" }, { lap: 30, n: 4, comp: "Medium" }]);
  });
  it("bozuk kayıt / geçersiz tur atlanır (uydurma satır yok)", () => {
    expect(tyreEvents({ 0: "4|M", "-3": "4|M", abc: "4|M", 5: "çöp", 6: "9|M" }))
      .toEqual([]);
  });
  it("boş/None girdide çökmez", () => {
    expect(tyreEvents(null)).toEqual([]);
    expect(tyreEvents("metin")).toEqual([]);
  });
});

describe("lastLap", () => {
  it("en yüksek tamamlanmış turu verir", () => {
    expect(lastLap({ 1: 100, 2: 99, 17: 98 })).toBe(17);
    expect(lastLap({})).toBe(0);
    expect(lastLap(null)).toBe(0);
  });
});

describe("buildLedger", () => {
  it("hiç değişim yoksa tek 'Başlangıç' dönemi (n bilinmiyor)", () => {
    const r = buildLedger({}, { 1: 100, 2: 100, 8: 100 });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ fromLap: 1, toLap: 8, n: null, open: true, fresh: false });
  });

  it("veri hiç yoksa BOŞ (uydurma dönem üretmez)", () => {
    expect(buildLedger({}, {})).toEqual([]);
    expect(buildLedger(null, null)).toEqual([]);
  });

  it("tam set değişimi yeni dönem açar ve YENİ işaretlenir", () => {
    const r = buildLedger({ 20: "4|Medium" }, { 1: 1, 35: 1 });
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ fromLap: 1, toLap: 20, n: null, open: false });
    expect(r[1]).toMatchObject({ fromLap: 20, toLap: 35, n: 4, fresh: true,
      partial: false, comp: "Medium", open: true });
  });

  it("aks değişimi (2 lastik) YENİ SET sayılmaz — 'partial'", () => {
    const r = buildLedger({ 20: "2|Medium" }, { 1: 1, 30: 1 });
    expect(r[1]).toMatchObject({ n: 2, fresh: false, partial: true });
  });

  /* n=0 = yakıt-only durak. Yeni dönem AÇMAMALI: lastik değişmediği için aynı
     lastikler devam eder; satır açsaydık defter "lastik değişti" diye yanlış
     okunurdu. Ama bilgi kaybolmasın diye dönemde SAYILIR. */
  it("yakıt-only durak dönem AÇMAZ, dönemde sayılır", () => {
    const r = buildLedger({ 15: "0|Medium", 30: "4|Medium" }, { 1: 1, 40: 1 });
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ fromLap: 1, toLap: 30, fuelOnly: 1 });
    expect(r[1]).toMatchObject({ fromLap: 30, n: 4, fuelOnly: 0 });
  });

  it("çok duraklı yarışta dönemler zincirlenir", () => {
    const r = buildLedger({ 20: "4|Medium", 45: "2|Medium", 70: "4|Wet" },
      { 1: 1, 88: 1 });
    expect(r.map((x) => [x.fromLap, x.toLap])).toEqual([[1, 20], [20, 45], [45, 70], [70, 88]]);
    expect(r.map((x) => x.comp)).toEqual([null, "Medium", "Medium", "Wet"]);
    expect(r[3].open).toBe(true);
  });

  it("tur haritası değişimin gerisinde kalsa bile toLap tutarlı", () => {
    // son değişim 50. turda ama livelaps yalnız 40'a kadar yazılmış (gecikme)
    const r = buildLedger({ 50: "4|Medium" }, { 1: 1, 40: 1 });
    expect(r[1].fromLap).toBe(50);
    expect(r[1].toLap).toBeGreaterThanOrEqual(50);   // geriye giden aralık üretmez
    expect(r[1].laps).toBeGreaterThanOrEqual(0);
  });
});

describe("ledgerSummary", () => {
  it("değişim sayılarını toplar", () => {
    const r = buildLedger({ 20: "4|M", 40: "2|M", 55: "0|M", 60: "4|M" },
      { 1: 1, 80: 1 });
    expect(ledgerSummary(r)).toMatchObject({ periods: 4, fullSets: 2, axleChanges: 1, fuelOnly: 1 });
  });
  it("boş girdide sıfırlar", () => {
    expect(ledgerSummary([])).toMatchObject({ periods: 0, fullSets: 0 });
    expect(ledgerSummary(null)).toMatchObject({ periods: 0 });
  });
});
