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

describe("duck pist haritası (v1.7.1)", () => {
  it("GPS oran düzeltmesi: boylam cos(enlem) ile ölçeklenir (pist dikeyde uzamaz)", () => {
    const d = ds();
    // Le Mans ~47.9° enlem: 0.01° boylam ve 0.01° enlem eşit DERECE ama eşit metre değil
    d.cont.posx = cont(10, 2400, (i) => 0.208 + 0.01 * Math.sin(i / 100));
    d.cont.posz = cont(10, 2400, (i) => 47.95 + 0.01 * Math.cos(i / 100));
    const laps = duckLaps(d);
    const tr = buildDuckTrace(buildDuckReaders(d), laps[1], 600);
    expect(tr.mapSrc).toBe("gps");
    const span = (a) => Math.max(...a) - Math.min(...a);
    // ham derecelerde oran 1:1 olurdu; düzeltme sonrası x/y ≈ cos(47.95°) ≈ 0.67
    expect(span(tr.x) / span(tr.y)).toBeCloseTo(Math.cos((47.95 * Math.PI) / 180), 1);
  });

  it("GPS yoksa hız+yanal-G'den yeniden kurar (mapSrc=g) → harita/zoom/Büyüt gelir", () => {
    const d = ds();
    delete d.cont.posx; delete d.cont.posz;
    d.cont.latg = cont(10, 2400, () => 1.2);   // sabit 1.2g sola → kapalı-benzeri döngü
    const laps = duckLaps(d);
    const tr = buildDuckTrace(buildDuckReaders(d), laps[1], 600);
    expect(tr.mapSrc).toBe("g");
    expect(tr.x.length).toBe(600);
    const span = (a) => Math.max(...a) - Math.min(...a);
    expect(span(tr.x)).toBeGreaterThan(0);
    expect(span(tr.y)).toBeGreaterThan(0);
    const cmp = buildCompare(tr, buildDuckTrace(buildDuckReaders(d), laps[0], 600));
    expect(cmp.hasMap).toBe(true);
  });

  it("ne GPS ne yanal-G → harita yok (mapSrc/x tanımsız, çökme yok)", () => {
    const d = ds();
    delete d.cont.posx; delete d.cont.posz;
    const laps = duckLaps(d);
    const tr = buildDuckTrace(buildDuckReaders(d), laps[1], 600);
    expect(tr.x).toBeUndefined();
    expect(tr.mapSrc).toBeUndefined();
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
