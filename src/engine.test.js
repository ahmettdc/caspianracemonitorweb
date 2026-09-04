import { describe, it, expect } from "vitest";
import {
  parseHMS, parseLap, fmtHMS, fmtLap, fmtGap, fmtDur, msToLocalInput,
  DEFAULT_STATE, WEATHER, wxLog, wxAtRel, WX, effLapSec, effCons, tyState,
  computePlan, migrate, lastStintFuel, wetnessLevel, rainLevel, rubberPct,
  isRacePast, raceEndsBy,
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
  it("parseLap: Avrupa nokta yazımı 'm.ss.d' DAKİKA sayılır (v1.8.11 bug: 2.21 sn sanılıyordu)", () => {
    expect(parseLap("2.21.0")).toBeCloseTo(141.0, 6);      // 2:21.0
    expect(parseLap("1.58.234")).toBeCloseTo(118.234, 6);  // 1:58.234
    expect(parseLap("2,21,0")).toBeCloseTo(141.0, 6);      // virgül varyantı
    expect(parseLap("2.75.3")).toBeCloseTo(2.75, 6);       // orta grup 00-59 değil → eski davranış
    expect(parseLap("95.5")).toBeCloseTo(95.5, 6);         // tek nokta = saniye (değişmedi)
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
    expect(fmtLap(0)).toBe("0:00.00");
  });
  it("fmtLap: saniye 60'a yuvarlanınca dakikaya taşar (1:60.00 hatası yok)", () => {
    expect(fmtLap(119.996)).toBe("2:00.00");
    expect(fmtLap(59.999)).toBe("1:00.00");
    expect(fmtLap(3599.999)).toBe("60:00.00");
  });
  it("fmtLap: negatif değer (delta) doğru gösterilir", () => {
    expect(fmtLap(-5.2)).toBe("-0:05.20");
    expect(fmtLap(-65)).toBe("-1:05.00");
  });
  it("fmtGap: 60 sn altı ondalık, üstü m:ss.s", () => {
    expect(fmtGap(12.34)).toBe("+12.3");
    expect(fmtGap(59.94)).toBe("+59.9");
    expect(fmtGap(60)).toBe("+1:00.0");
    expect(fmtGap(125.5)).toBe("+2:05.5");
  });
  it("fmtGap: saniye 60'a yuvarlanınca dakikaya taşar (+1:60.0 hatası yok)", () => {
    expect(fmtGap(59.96)).toBe("+1:00.0");
    expect(fmtGap(119.96)).toBe("+2:00.0");
    expect(fmtGap(3599.97)).toBe("+60:00.0");
  });
  it("fmtDur: işaretsiz süre — taşma yok (strateji rozetleri bunu kullanır)", () => {
    expect(fmtDur(12.34)).toBe("12.3");
    expect(fmtDur(59.96)).toBe("1:00.0");     // eski yerel kopya "60.0" veriyordu
    expect(fmtDur(119.96)).toBe("2:00.0");    // eski: "1:60.0"
    expect(fmtDur(3599.97)).toBe("60:00.0");  // eski: "59:60.0"
    expect(fmtDur(125.5)).toBe("2:05.5");
    expect(fmtDur(0)).toBe("—");
    expect(fmtDur(null)).toBe("—");
  });
  it("fmtGap = '+' + fmtDur (tek kaynak)", () => {
    for (const v of [12.34, 59.96, 119.96, 3599.97]) {
      expect(fmtGap(v)).toBe(`+${fmtDur(v)}`);
    }
  });
  it("fmtGap: geçersiz/sıfır/negatif → tire", () => {
    expect(fmtGap(0)).toBe("—");
    expect(fmtGap(-3)).toBe("—");
    expect(fmtGap(null)).toBe("—");
    expect(fmtGap(undefined)).toBe("—");
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
    expect(effLapSec(wet)).toBeCloseTo(240 * 1.10, 6);
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

  it("stinte özel VE tüketimi (stintCons) o stintin fuelNeed'ini değiştirir", () => {
    // 20 dk tek stint, tüketim 10 %/tur, 6 tur → fuelNeed ≈ 60
    const base = computePlan(baseState({ raceTime: "0:20:00" }), "race");
    const cons = []; cons[0] = 6;   // ilk stint düşük tüketim override
    const low = computePlan(baseState({ raceTime: "0:20:00", stintCons: cons }), "race");
    expect(low.rows[0].fuelNeed).toBeLessThan(base.rows[0].fuelNeed);
    expect(low.rows[0].fuelNeed).toBeCloseTo(base.rows[0].fuelNeed * 0.6, 3);
  });
  it("stintCons boş/geçersizse yarış datasındaki tüketim geçerli (fuelNeed sabit)", () => {
    const base = computePlan(baseState({ raceTime: "0:20:00" }), "race");
    const cons = []; cons[0] = "";  // boş → global tüketim
    const same = computePlan(baseState({ raceTime: "0:20:00", stintCons: cons }), "race");
    expect(same.rows[0].fuelNeed).toBeCloseTo(base.rows[0].fuelNeed, 6);
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
    expect(plan.lapSec).toBeCloseTo(240 * 1.10, 6);
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

/* ============================================================
   REGRESYON — stint bölümü derin taraması (v1.4.53)
   ============================================================ */
describe("computePlan — yozlaşmış girdi (hayalet stint koruması)", () => {
  it("Avg Lap boşaltılırsa plan ÜRETİLMEZ (eskiden 64 hayalet satır + uydurma tur)", () => {
    const plan = computePlan(baseState({ avgLap: "" }), "race");
    expect(plan.rows.length).toBe(0);
    expect(plan.totalLaps).toBe(0);
    expect(plan.invalid).toBe(true);
  });

  it("seçili stratejinin tur sayısı 0 ise plan ÜRETİLMEZ", () => {
    const plan = computePlan(baseState({ strategies: { A: 5, B: 8, C: 0, D: 11 } }), "race");
    expect(plan.rows.length).toBe(0);
    expect(plan.invalid).toBe(true);
  });

  it("geçerli girdide invalid=false ve plan bayrağa ulaşır", () => {
    const plan = computePlan(baseState(), "race");
    expect(plan.invalid).toBe(false);
    expect(plan.truncated).toBe(false);
    expect(plan.rows[plan.rows.length - 1].isLast).toBe(true);
  });

  it("64 stint tavanına takılan plan truncated işaretlenir", () => {
    // 24 saat + 2 turluk stint → 64 stint yetmez
    const plan = computePlan(
      baseState({ raceTime: "24:00:00", strategies: { A: 5, B: 8, C: 2, D: 11 } }), "race");
    expect(plan.rows.length).toBe(64);
    expect(plan.rows[63].isLast).toBe(false);
    expect(plan.truncated).toBe(true);
    expect(plan.invalid).toBe(false);
  });

  it("makul olmayan Avg Lap (< 30 sn — yazım hatası) plan ÜRETMEZ (invalid)", () => {
    // "2.21" → 2.21 sn: gerçek tur olamaz → 64 hayalet stint yerine invalid uyarısı
    const plan = computePlan(baseState({ avgLap: "2.21" }), "race");
    expect(plan.rows.length).toBe(0);
    expect(plan.invalid).toBe(true);
  });
});

describe("isRacePast / raceEndsBy — 'Sonraki Yarış' geçmiş eşiği yarış SÜRESİNE göre", () => {
  const NOW = 1_700_000_000_000;
  const H = 3600e3;
  it("4h yarış: bitişten ~1h sonra → past", () => {
    const r = { startsAt: NOW - 5 * H, raceTime: "4:00:00" };   // bitiş NOW-1h
    expect(isRacePast(r, NOW)).toBe(true);
  });
  it("4h yarış: hâlâ sürüyor (start 3h önce) → not past", () => {
    const r = { startsAt: NOW - 3 * H, raceTime: "4:00:00" };
    expect(isRacePast(r, NOW)).toBe(false);
  });
  it("tampon: bitişten 20 dk sonra → not past, 40 dk sonra → past", () => {
    const in20 = { startsAt: NOW - (4 * H + 20 * 60e3), raceTime: "4:00:00" };
    const in40 = { startsAt: NOW - (4 * H + 40 * 60e3), raceTime: "4:00:00" };
    expect(isRacePast(in20, NOW)).toBe(false);   // 30 dk pay içinde
    expect(isRacePast(in40, NOW)).toBe(true);
  });
  it("raceTime yoksa eski 6h-başlangıç eşiğine düşer", () => {
    expect(isRacePast({ startsAt: NOW - 5 * H }, NOW)).toBe(false);   // 6h dolmadı
    expect(isRacePast({ startsAt: NOW - 7 * H }, NOW)).toBe(true);    // 6h geçti
  });
  it("REGRESYON: 24h yarış start'tan 8h sonra (hâlâ sürerken) → NOT past", () => {
    // eski sabit-6h kuralı bunu yanlışlıkla Geçmiş'e düşürüyordu
    const r = { startsAt: NOW - 8 * H, raceTime: "24:00:00" };
    expect(isRacePast(r, NOW)).toBe(false);
    expect(raceEndsBy(r)).toBe(NOW - 8 * H + 24 * H + 30 * 60e3);
  });
});

describe("computePlan — stinte özel tur süresi (v1.8.11 bug: 2.21.0 → 46 sn'lik stint)", () => {
  const withStintLap = (i, v, over = {}) => {
    const stintLaps = Array(14).fill("");
    stintLaps[i] = v;
    return computePlan(baseState({ stintLaps, ...over }), "race");
  };

  it("'2.21.0' artık 2:21.0 sayılır — stint 46 sn'ye ÇÖKMEZ (regresyon)", () => {
    // Eski davranış: parseLap("2.21.0")=2.21 sn → 10 tur × 2.21 = 22 sn'lik stint →
    // plan daha 1. stint bitmeden 2.'ye atlıyordu. Şimdi 141 sn/tur → 1410 sn stint.
    const plan = withStintLap(0, "2.21.0");
    expect(plan.rows[0].fixLap).toBeCloseTo(141.0, 6);
    expect(plan.rows[0].stintSec).toBeCloseTo(1410, 1);    // 10 tur × 2:21.0
  });

  it("makul olmayan override ('2.21' → 2.21 sn) YOK SAYILIR, yarış ortalaması kullanılır", () => {
    const plan = withStintLap(0, "2.21");
    expect(plan.rows[0].fixLap).toBe(0);                   // yok sayıldı → UI kırmızı gösterir
    expect(plan.rows[0].stintSec).toBeCloseTo(2400, 1);    // 10 tur × 4:00 (yarış ort.)
  });

  it("geçerli override (ör. '3:30.00') aynen uygulanır", () => {
    const plan = withStintLap(0, "3:30.00");
    expect(plan.rows[0].fixLap).toBeCloseTo(210, 6);
    expect(plan.rows[0].stintSec).toBeCloseTo(2100, 1);
  });
});

describe("computePlan — tur override'ı yarışa sığmazsa bayrağa kırpılır", () => {
  const withLapOvr = (i, n, over = {}) => {
    const lapOverrides = Array(14).fill("");   // lapOverrides migrate ile eklenir
    lapOverrides[i] = String(n);
    return computePlan(baseState({ lapOverrides, ...over }), "race");
  };

  it("sığan tur override'ı aynen uygulanır", () => {
    const plan = withLapOvr(0, 8);            // 8×240 = 1920 sn < 3600
    expect(plan.rows[0].lapsInStint).toBe(8);
    expect(plan.rows[0].stintSec).toBeCloseTo(1920, 6);
    expect(plan.rows[0].isLast).toBe(false);
  });

  it("aşan tur override'ı stint'i bayrakta bitirir (eskiden endSec > raceSec, timeLeft < 0)", () => {
    const plan = withLapOvr(0, 100);          // 100×240 = 24000 sn ≫ 3600
    const r = plan.rows[0];
    expect(r.isLast).toBe(true);
    expect(r.stintSec).toBeCloseTo(plan.raceSec, 6);
    expect(r.endSec).toBeCloseTo(plan.raceSec, 6);
    expect(r.timeLeft).toBeCloseTo(0, 6);
    expect(r.lapsInStint).toBe(16);           // 15 tam tur + bayrak turu
    expect(r.fuelNeed).toBeLessThan(1000);    // eskiden 100 turluk uydurma VE
  });

  it("kırpılmış stint zaman çizelgesini %100'ün üstüne taşırmaz", () => {
    const plan = withLapOvr(1, 100);
    const total = plan.rows.reduce((a, r) => a + r.stintSec + r.pitSec, 0);
    expect(total).toBeLessThanOrEqual(plan.raceSec + 0.001);
  });

  /* Regresyon (v2.1.1): elle tur override'lı son stint yarışı TAM doldurmayıp bayrağa
     bir pit süresinden az kala biterse, motor arkasına HAYALET SON PİT ekliyordu →
     plan bayrağı aşıyor (endSec > raceSec, timeLeft < 0), döngü kırılıyor ve son satır
     isLast=false kalıp "plan tamamlanamadı — -00:00:20" yanlış uyarısı çıkıyordu.
     Artık: pit bayrağa ulaşıyorsa o stint SON stinttir (pit yok, bayrağa kadar uzar). */
  it("bayrağa bir pit'ten az kala biten son override'da HAYALET PİT eklenmez", () => {
    const lapOverrides = Array(14).fill("");
    lapOverrides[0] = "4";  // 4×240 = 960 sn → bayrağa (1000) 40 sn kala biter (< pit)
    const plan = computePlan(baseState({ raceTime: "16:40", lapOverrides }), "race"); // 1000 sn
    const last = plan.rows[plan.rows.length - 1];
    expect(plan.rows.length).toBe(1);           // arkasına hayalet stint/pit satırı yok
    expect(last.isLast).toBe(true);
    expect(last.pitSec).toBe(0);                // son stintte pit yok
    expect(last.endSec).toBeCloseTo(1000, 3);   // bayrağı AŞMAZ (eskiden 1020)
    expect(last.timeLeft).toBeCloseTo(0, 3);    // eskiden -20
    expect(plan.truncated).toBe(false);         // "plan tamamlanamadı" uyarısı YOK
  });
});

describe("computePlan — totalFuel (Toplam VE) satırlarla tutarlı", () => {
  it("totalFuel = satırların fuelNeed toplamı", () => {
    const plan = computePlan(baseState(), "race");
    const sum = plan.rows.reduce((a, r) => a + r.fuelNeed, 0);
    expect(plan.totalFuel).toBeCloseTo(sum, 9);
  });

  it("tek havada eski formülle (effCons × totalLaps) BİREBİR aynı — regresyon yok", () => {
    for (const w of [[], [{ t: 0, w: "wet" }]]) {
      const st = baseState({ weatherLog: w });
      const plan = computePlan(st, "race");
      expect(plan.totalFuel).toBeCloseTo(effCons(st) * plan.totalLaps, 6);
    }
  });

  it("karma havada eski formülden AYRIŞIR (tur-tur gerçek hava)", () => {
    // yarışın son çeyreği ıslak: eski formül tüm turlara wet çarpanı uygular
    const st = baseState({ weatherLog: [{ t: 2700, w: "wet" }] });
    const plan = computePlan(st, "race");
    const eski = effCons(st) * plan.totalLaps;
    expect(plan.totalFuel).toBeGreaterThan(eski + 1);   // eski değer yakıtı EKSİK sayıyordu
  });
});

/* ============================================================
   Oyunun KELİMELERİ: yüzde → kademe (v1.4.63)
   ============================================================ */
describe("wetnessLevel — zemin ıslaklığı % → WEATHER kademesi", () => {
  it("oyun aralıkları: dry 0-4 · damp 5-11 · slwet 12-39 · wet 40-99 · xwet 100", () => {
    expect(wetnessLevel(0)).toBe("dry");
    expect(wetnessLevel(4)).toBe("dry");        // dry üst sınır (dahil)
    expect(wetnessLevel(5)).toBe("damp");       // damp alt sınır (dahil)
    expect(wetnessLevel(11)).toBe("damp");
    expect(wetnessLevel(12)).toBe("slwet");
    expect(wetnessLevel(39)).toBe("slwet");
    expect(wetnessLevel(40)).toBe("wet");
    expect(wetnessLevel(99)).toBe("wet");
    expect(wetnessLevel(100)).toBe("xwet");     // yalnız tam %100 extremely wet
  });
  it("veri yoksa null (kademe uydurulmaz)", () => {
    expect(wetnessLevel(null)).toBeNull();
    expect(wetnessLevel(undefined)).toBeNull();
    expect(wetnessLevel("abc")).toBeNull();
  });
  it("döndürülen id WEATHER'da var ve etiketi oyunun kelimesi", () => {
    expect(WEATHER[wetnessLevel(100)].lbl).toBe("Extremely Wet");
    expect(WEATHER[wetnessLevel(70)].lbl).toBe("Wet");
    expect(WEATHER[wetnessLevel(20)].lbl).toBe("Slightly Wet");
    expect(WEATHER[wetnessLevel(8)].lbl).toBe("Damp");
    expect(WEATHER[wetnessLevel(2)].lbl).toBe("Dry");
  });
});

describe("rainLevel — yağış % → kademe adı", () => {
  it("kullanıcının belirttiği set: No Rain/Drizzle/Light Rain/Rain/Heavy Rain", () => {
    expect(rainLevel(0).lbl).toBe("No Rain");
    expect(rainLevel(2).lbl).toBe("No Rain");
    expect(rainLevel(2.1).lbl).toBe("Drizzle");
    expect(rainLevel(15).lbl).toBe("Drizzle");
    expect(rainLevel(15.1).lbl).toBe("Light Rain");
    expect(rainLevel(40).lbl).toBe("Light Rain");
    expect(rainLevel(40.1).lbl).toBe("Rain");
    expect(rainLevel(70).lbl).toBe("Rain");
    expect(rainLevel(70.1).lbl).toBe("Heavy Rain");
  });
  it("veri yoksa null", () => {
    expect(rainLevel(null)).toBeNull();
    expect(rainLevel("x")).toBeNull();
  });
});

describe("WEATHER.xwet — 5. kademe", () => {
  it("ıslaklık arttıkça tur çarpanı artar, yakıt çarpanı azalır", () => {
    const ids = ["dry", "damp", "slwet", "wet", "xwet"];
    const laps = ids.map((i) => WEATHER[i].lap);
    const fuels = ids.map((i) => WEATHER[i].fuel);
    expect(laps).toEqual([...laps].sort((a, b) => a - b));          // artan
    expect(fuels).toEqual([...fuels].sort((a, b) => b - a));        // azalan
    expect(WEATHER.xwet.lap).toBeGreaterThan(WEATHER.wet.lap);
    expect(WEATHER.xwet.fuel).toBeLessThan(WEATHER.wet.fuel);
  });
  it("plan hesabı 5. kademeyi kullanabiliyor (en ıslakta tur uzar)", () => {
    const dry = computePlan(baseState(), "race");
    const xw = computePlan(baseState({ weatherLog: [{ t: 0, w: "xwet" }] }), "race");
    expect(xw.lapSec).toBeCloseTo(dry.lapSec * WEATHER.xwet.lap, 6);
    expect(xw.totalLaps).toBeLessThan(dry.totalLaps);               // yavaş → az tur
  });
});

describe("rubberPct — TinyPedal tutuş (rubber) tahmini", () => {
  it("0 turda başlangıç kauçuğuna round-trip eder", () => {
    expect(rubberPct("Yarış", 0)).toBe(50);        // yarış/qual/warmup start 0.5
    expect(rubberPct("Isınma", 0)).toBe(50);
    expect(rubberPct("Sıralama", 0)).toBe(50);
    expect(rubberPct("Antrenman", 0)).toBe(25);    // practice/test start 0.25
    expect(rubberPct("Test", 0)).toBe(25);
  });
  it("turlar biriktikçe artar (TinyPedal 'Dry 31%' ≈ antrenman ~120 tur)", () => {
    expect(rubberPct("Antrenman", 120)).toBe(30);
    expect(rubberPct("Yarış", 600)).toBe(73);
  });
  it("çok turda %100 tavanına oturur, monoton artan", () => {
    expect(rubberPct("Yarış", 3000)).toBe(100);
    expect(rubberPct("Yarış", 99999)).toBe(100);
    const a = rubberPct("Yarış", 100);
    const b = rubberPct("Yarış", 500);
    const c = rubberPct("Yarış", 1500);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });
  it("geçersiz/negatif totalLaps → başlangıç yüzdesi", () => {
    expect(rubberPct("Yarış", null)).toBe(50);
    expect(rubberPct("Yarış", -10)).toBe(50);
    expect(rubberPct("Antrenman", undefined)).toBe(25);
  });
});

/* REGRESYON (v2.4.1) — SON STİNTİN DOLUMU kendi tur süresini kullanır.
   `pctForPit` kalan tur sayısını `cd / lapSec` ile buluyordu; `lapSec` YARIŞ
   ortalamasıdır. Aynı fonksiyon stinte özel VE tüketimini (`stintCons[i+1]`)
   özenle hesaba katıyor ama tur süresini (`fixLap`, satırda zaten hazır)
   yok sayıyordu. Son stinte ortalamadan HIZLI bir tur girildiğinde kalan tur
   BİR EKSİK sayılıyor ve plan bir tur eksik yakıt söylüyordu — yarışta
   yakıtsız kalmak demek. */
describe("computePlan — son stintin dolumu stintin KENDİ turunu kullanır", () => {
  const planWithLastLap = (v) => {
    const st = { ...DEFAULT_STATE, raceTime: "1:00:00", avgLap: "4:00.00",
      consumption: 10, strategies: { A: 5, B: 8, C: 10, D: 11 }, chosen: "C",
      weatherLog: [], pitLaneTime: 20, fuelTime: 40, extraLap: 1,
      fuelRatio: 0.86, multiclass: false, leaderLap: "" };
    const plan = computePlan(st, "race");
    const li = plan.rows.length - 1;          // son stintin indeksi
    if (!v) return plan;
    const stintLaps = Array(14).fill("");
    stintLaps[li] = v;
    return computePlan({ ...st, stintLaps }, "race");
  };

  it("hızlı son stint → daha ÇOK tur kalır → daha ÇOK yakıt (eksik dolum yok)", () => {
    const base = planWithLastLap(null);
    const fast = planWithLastLap("3:00.00");   // yarış ort. 4:00'ten hızlı
    expect(base.lastRefuelPct).not.toBe(null);
    expect(fast.lastRefuelPct).not.toBe(null);
    expect(fast.lastRefuelPct).toBeGreaterThan(base.lastRefuelPct);
  });

  it("yavaş son stint → daha AZ tur kalır → daha AZ yakıt (fazla dolum yok)", () => {
    const base = planWithLastLap(null);
    const slow = planWithLastLap("5:30.00");
    expect(slow.lastRefuelPct).toBeLessThan(base.lastRefuelPct);
  });

  it("son stinte override YOKSA davranış değişmez (yarış ortalaması)", () => {
    /* Kök-neden koruması: düzeltme yalnız fixLap > 0 iken devreye girmeli. */
    expect(planWithLastLap(null).lastRefuelPct)
      .toBeCloseTo(planWithLastLap("").lastRefuelPct, 6);
  });
});
