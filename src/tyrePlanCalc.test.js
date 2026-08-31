import { describe, it, expect } from "vitest";
import { isDrySet, effectiveGrid, planTread, changeTimeOf, totalChangeTime,
  measuredWear } from "./tyrePlanCalc";

describe("isDrySet", () => {
  it("W bir SET DEĞİL (yer tutucu) — diş hesabına girmez", () => {
    expect(isDrySet("W")).toBe(false);
    expect(isDrySet("5")).toBe(true);
    expect(isDrySet("")).toBe(false);
    expect(isDrySet("  ")).toBe(false);
    expect(isDrySet(null)).toBe(false);
  });
});

describe("effectiveGrid (taşıma semantiği)", () => {
  it("boş hücre yukarıdan devralır", () => {
    expect(effectiveGrid(["1", "2", "3", "4"], [
      ["", "", "", ""],
      ["5", "", "", ""],
    ])).toEqual([
      ["1", "2", "3", "4"],
      ["1", "2", "3", "4"],
      ["5", "2", "3", "4"],
    ]);
  });
  it("bozuk girdide çökmez", () => {
    expect(effectiveGrid(null, null)).toEqual([["", "", "", ""]]);
  });
});

describe("planTread", () => {
  it("ilk kullanım YENİ, sonrakiler aşınmış", () => {
    const g = planTread(["1", "2", "3", "4"], [["", "", "", ""]], 0.3);
    expect(g[0][0]).toMatchObject({ uses: 0, fresh: true, start: 1 });
    expect(g[0][0].end).toBeCloseTo(0.7, 9);
    // taşınan aynı set → ikinci kullanım
    expect(g[1][0]).toMatchObject({ uses: 1, fresh: false });
    expect(g[1][0].start).toBeCloseTo(0.7, 9);
    expect(g[1][0].end).toBeCloseTo(0.4, 9);
  });

  /* Bir set numarası TEK köşeye aittir (köşe kilidi) — aynı numarayı dört köşeye
     koymak geçersiz girdidir, senaryo ona göre kurulur. */
  it("diş eksiye düşerse blowout", () => {
    const g = planTread(["1", "2", "3", "4"],
      [["", "", "", ""], ["", "", "", ""], ["", "", "", ""]], 0.3);
    // 1 numara FL'de 4 stint koşuyor: 1.0 → 0.7 → 0.4 → 0.1 → -0.2
    expect(g.map((r) => +r[0].start.toFixed(2))).toEqual([1, 0.7, 0.4, 0.1]);
    expect(g[3][0].blowout).toBe(true);
    expect(g[2][0].blowout).toBe(false);
  });

  /* W hücresi diş hesabına GİRMEZ: iki ayrı W aynı fiziksel lastik değildir,
     saysaydık her W öncekinin üstüne aşınma biriktirir ve uydurma bir "blowout"
     üretirdi. */
  it("wet hücresi null döner, aşınma biriktirmez", () => {
    const g = planTread(["W", "W", "W", "W"],
      [["W", "W", "W", "W"], ["W", "W", "W", "W"]], 0.3);
    expect(g[0][0]).toBe(null);
    expect(g[2][0]).toBe(null);
  });

  it("aşınma 0/geçersizse diş sabit kalır (uydurma düşüş yok)", () => {
    const g = planTread(["1", "", "", ""], [["", "", "", ""]], 0);
    expect(g[0][0].end).toBe(1);
    expect(g[1][0].start).toBe(1);
  });

  it("farklı setler birbirinin aşınmasını etkilemez", () => {
    const g = planTread(["1", "2", "3", "4"], [["5", "", "", ""]], 0.3);
    expect(g[1][0]).toMatchObject({ id: "5", uses: 0, fresh: true });
    expect(g[1][1]).toMatchObject({ id: "2", uses: 1, fresh: false });
  });
});

describe("changeTimeOf / totalChangeTime", () => {
  it("1–2 lastik ucuz, 3–4 pahalı (TinyPedal eşiği)", () => {
    expect(changeTimeOf(1, 4.5, 12)).toBe(4.5);
    expect(changeTimeOf(2, 4.5, 12)).toBe(4.5);
    expect(changeTimeOf(3, 4.5, 12)).toBe(12);
    expect(changeTimeOf(4, 4.5, 12)).toBe(12);
  });
  it("değişim yoksa süre yok", () => {
    expect(changeTimeOf(0, 4.5, 12)).toBe(0);
    expect(changeTimeOf(null, 4.5, 12)).toBe(0);
  });
  it("plan toplamı", () => {
    expect(totalChangeTime([{ n: 4 }, { n: 2 }, { n: 4 }], 4.5, 12)).toBe(28.5);
    expect(totalChangeTime(null, 4.5, 12)).toBe(0);
  });
});

describe("measuredWear (TinyPedal'da yok — o yazdırır, biz ölçeriz)", () => {
  const tyres = (w) => ({ fl: { wear: w }, fr: { wear: w }, rl: { wear: w }, rr: { wear: w } });
  const period = { n: 4, open: true, fromLap: 10 };

  it("taze setle başlayan açık dönemde tur başına aşınmayı ölçer", () => {
    // 10. turda taze, 30. turda %0.60 diş → 20 turda 0.40 aşınmış
    const m = measuredWear(period, tyres(0.6), 30, 25);
    expect(m.laps).toBe(20);
    expect(m.perLap).toBeCloseTo(0.02, 9);
    expect(m.perStint).toBeCloseTo(0.5, 9);   // 25 turluk stint
    expect(m.tread).toBe(0.6);
  });

  it("EN KÖTÜ köşe belirler (ortalama değil)", () => {
    const mixed = { fl: { wear: 0.9 }, fr: { wear: 0.9 }, rl: { wear: 0.5 }, rr: { wear: 0.9 } };
    expect(measuredWear(period, mixed, 20, 20).tread).toBe(0.5);
  });

  /* Kısmi (2 lastik) değişimde iki köşenin geçmişi bilinmiyor → başlangıç dişi
     bilinemez → ölçüm YAPILMAZ. Tahmin üretmek yerine null. */
  it("kısmi değişimde ölçüm YAPMAZ", () => {
    expect(measuredWear({ n: 2, open: true, fromLap: 10 }, tyres(0.6), 30, 25)).toBe(null);
  });

  it("kapanmış dönemde ölçüm yapmaz (başlangıç dişi doğrulanamaz)", () => {
    expect(measuredWear({ n: 4, open: false, fromLap: 10 }, tyres(0.6), 30, 25)).toBe(null);
  });

  it("yetersiz tur / eksik köşe / aşınmamış lastik → null", () => {
    expect(measuredWear(period, tyres(0.6), 10, 25)).toBe(null);   // 0 tur
    expect(measuredWear(period, { fl: { wear: 0.6 } }, 30, 25)).toBe(null);
    expect(measuredWear(period, tyres(1), 30, 25)).toBe(null);     // hiç aşınmamış
    expect(measuredWear(null, tyres(0.6), 30, 25)).toBe(null);
    expect(measuredWear(period, null, 30, 25)).toBe(null);
  });

  it("stint turu bilinmiyorsa perStint null ama perLap yine ölçülür", () => {
    const m = measuredWear(period, tyres(0.6), 30, 0);
    expect(m.perLap).toBeCloseTo(0.02, 9);
    expect(m.perStint).toBe(null);
  });
});
