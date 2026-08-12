import { describe, it, expect } from "vitest";
import { buildDuckReaders, buildDuckTrace, buildCompare } from "./duckTrace";
import { duckLaps } from "./duckParse";

const cont = (hz, n, f) => ({ hz, v: Array.from({ length: n }, (_, i) => f(i)) });
function ds() {
  return {
    t0: 10, tEnd: 250,
    cont: {
      speed: cont(10, 2400, () => 150),
      throttle: cont(50, 12000, () => 80), brake: cont(50, 12000, () => 10),
      rpm: cont(100, 24000, () => 7000), steer: cont(100, 24000, () => 0),
      dist: cont(10, 2400, (i) => (i % 1200) * 5),
      posx: cont(10, 2400, (i) => Math.sin(i / 100)),
      posz: cont(10, 2400, (i) => Math.cos(i / 100)),
    },
    cont4: {},
    evt: {
      lap: [{ ts: 10, value: 0 }, { ts: 130, value: 1 }, { ts: 220, value: 2 }],
      laptime: [{ ts: 220, value: 90 }],
      gear: [{ ts: 10, value: 0 }, { ts: 140, value: 3 }, { ts: 200, value: 5 }],
    },
  };
}

describe("buildDuckTrace", () => {
  const d = ds();
  const laps = duckLaps(d);
  const R = buildDuckReaders(d);
  const tr = buildDuckTrace(R, laps[1], 600);
  it("ortak mesafe ızgarasında iz üretir (ldTrace şekliyle)", () => {
    expect(tr.dist.length).toBe(600);
    expect(tr.distUnit).toBe("m");
    expect(tr.len).toBeGreaterThan(0);
    expect(tr.time.length).toBe(600);
    expect(tr.speed).toBeTruthy();
    expect(tr.throttle).toBeTruthy();
    expect(tr.brake).toBeTruthy();
    expect(tr.rpm).toBeTruthy();
    expect(tr.steer).toBeTruthy();
  });
  it("vites = olay adım fonksiyonu (tamsayı)", () => {
    expect(tr.gear).toBeTruthy();
    expect(tr.gear.every((g) => g == null || Number.isInteger(g))).toBe(true);
    expect(tr.gear.some((g) => g === 3 || g === 5)).toBe(true);
  });
  it("pist haritası gerçek GPS'ten (mapSrc=gps)", () => {
    expect(tr.x).toBeTruthy();
    expect(tr.y).toBeTruthy();
    expect(tr.mapSrc).toBe("gps");
  });
  it("okuyucu/lap yoksa null", () => {
    expect(buildDuckTrace(null, laps[1])).toBeNull();
    expect(buildDuckTrace(R, null)).toBeNull();
  });
});

describe("buildCompare (duck izleri)", () => {
  const d = ds();
  const laps = duckLaps(d);
  const R = buildDuckReaders(d);
  const cmp = buildCompare(buildDuckTrace(R, laps[0]), buildDuckTrace(R, laps[1]));
  it("iki izi tek diziye birleştirir + sektör + harita", () => {
    expect(cmp.data.length).toBe(600);
    expect(cmp.chans).toMatchObject({ speed: true, throttle: true, brake: true, gear: true });
    expect(cmp.sectors.length).toBe(3);
    expect(cmp.hasMap).toBe(true);
    expect(cmp.data[0]).toHaveProperty("spA");
    expect(cmp.data[0]).toHaveProperty("dt");
  });
});
