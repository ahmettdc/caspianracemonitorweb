import { describe, it, expect } from "vitest";
import { duckLaps, duckMeta, sampleContAt } from "./duckParse";

/* Sentetik DuckDB dataset: t0=10, tEnd=250; 3 tur (out/uçuş/kısmi). */
const cont = (hz, n, f) => ({ hz, v: Array.from({ length: n }, (_, i) => f(i)) });
function ds() {
  return {
    t0: 10, tEnd: 250,
    meta: { TrackName: "Spa", CarName: "911 GT3 R", DriverName: "AD",
      SessionType: "Practice", WeatherConditions: "Dry", CarClass: "GT3",
      RecordingTime: "2026-08-08", CarSetup: '{"x":1}' },
    cont: {
      speed: cont(10, 2400, (i) => (i === 1200 ? 200 : 100)),   // km/h; tepe 200
      fuel: cont(1, 260, (i) => 100 - i * 0.1),                 // 20Hz değil ama örnek
      trk: cont(1, 260, () => 40), amb: cont(1, 260, () => 25),
      posx: cont(10, 2400, (i) => Math.sin(i / 100)),
      posz: cont(10, 2400, (i) => Math.cos(i / 100)),
      throttle: cont(50, 12000, () => 80), brake: cont(50, 12000, () => 0),
      rpm: cont(100, 24000, () => 7000), steer: cont(100, 24000, () => 0),
      dist: cont(10, 2400, (i) => (i % 1200) * 5),
    },
    cont4: { wear: { hz: 1, v: [0, 1, 2, 3].map(() => Array.from({ length: 260 }, (_, i) => 100 - i * 0.05)) } },
    evt: {
      lap: [{ ts: 10, value: 0 }, { ts: 130, value: 1 }, { ts: 220, value: 2 }],
      laptime: [{ ts: 220, value: 90 }],           // seg1 sonunda yayınlanır
      inpits: [{ ts: 10, value: 1 }, { ts: 40, value: 0 }],
      gear: [{ ts: 10, value: 0 }, { ts: 140, value: 3 }, { ts: 200, value: 5 }],
    },
  };
}

describe("duckLaps", () => {
  const laps = duckLaps(ds());
  it("üç turu segmentler (out/uçuş/kısmi)", () => {
    expect(laps.length).toBe(3);
    expect(laps.map((l) => l.lap)).toEqual([0, 1, 2]);
  });
  it("out turu: pit + partial + resmi süre yok", () => {
    const l = laps[0];
    expect(l.pit).toBe(true);
    expect(l.partial).toBe(true);
    expect(l.official).toBeNull();
    expect(l.sec).toBeCloseTo(120, 5);            // span
    expect(l.fuelL).toBeCloseTo(12, 1);           // 100 → 88
    expect(l.maxSpd).toBe(200);
  });
  it("uçuş turu: Lap Time olayından resmi süre; pit yok", () => {
    const l = laps[1];
    expect(l.official).toBe(90);
    expect(l.sec).toBe(90);
    expect(l.partial).toBe(false);
    expect(l.pit).toBe(false);
    expect(l.fuelL).toBeCloseTo(9, 1);            // 88 → 79
    expect(l.w.every((x) => x != null && x >= 0)).toBe(true);
  });
  it("son segment: sonraki Lap yoksa partial (tEnd = veri sonu)", () => {
    const l = laps[2];
    expect(l.partial).toBe(true);
    expect(l.sec).toBeCloseTo(30, 5);             // 220 → 250
  });
  it("kısa/geçersiz segmentleri eler (sec>10 & n>=5)", () => {
    const d = ds();
    d.evt.lap = [{ ts: 10, value: 0 }, { ts: 15, value: 1 }, { ts: 200, value: 2 }];
    const L = duckLaps(d);
    expect(L.find((l) => l.lap === 0)).toBeUndefined();   // 5 sn segment elenir
  });
  it("Lap olayı yoksa boş", () => {
    expect(duckLaps({ t0: 0, tEnd: 10, evt: {} })).toEqual([]);
    expect(duckLaps(null)).toEqual([]);
  });
});

describe("duckMeta", () => {
  const m = duckMeta(ds());
  it("venue/vehicle/driver + orta sıcaklıklar + kanal envanteri", () => {
    expect(m.venue).toBe("Spa");
    expect(m.vehicle).toBe("911 GT3 R");
    expect(m.driver).toBe("AD");
    expect(m.trk).toBe(40);
    expect(m.amb).toBe(25);
    expect(m.session).toBe("Practice");
    expect(m.carClass).toBe("GT3");
    expect(m.setup).toBe('{"x":1}');
    expect(m.channels).toMatchObject({ speed: true, throttle: true, gear: true, rpm: true });
  });
});

describe("sampleContAt", () => {
  it("mutlak zamanı kanal freq'iyle indeksler", () => {
    const ch = { hz: 10, v: [5, 6, 7, 8] };
    expect(sampleContAt(ch, 100, 100)).toBe(5);       // idx 0
    expect(sampleContAt(ch, 100, 100.2)).toBe(7);     // idx 2
  });
  it("aralık dışı / boş → null", () => {
    expect(sampleContAt({ hz: 10, v: [1, 2] }, 0, 99)).toBeNull();
    expect(sampleContAt(null, 0, 0)).toBeNull();
  });
});
