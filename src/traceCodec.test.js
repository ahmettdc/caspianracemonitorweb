import { describe, it, expect } from "vitest";
import { packTrace, unpackTrace, MAX_TRACE_STR } from "./traceCodec";
import { buildCompare } from "./ldTrace";

/* buildTrace çıktısını taklit eden sentetik iz (uniform grid — gerçek buildTrace
   dGrid[k]=len*k/(N-1) üretir; codec dist/frac'ı bundan türetir). */
function synthTrace(N = 300, { len = 4500, distUnit = "m", chans = null, mapSrc = "pos" } = {}) {
  const dGrid = Array.from({ length: N }, (_, k) => (len * k) / (N - 1));
  const tr = {
    distUnit, len,
    dist: distUnit === "frac" ? dGrid.map((d) => d * 100) : dGrid,
    frac: dGrid.map((d) => d / len),
    time: Array.from({ length: N }, (_, k) => +(90 * (k / (N - 1)) + Math.sin(k) * 0.2).toFixed(2)),
    speed: Array.from({ length: N }, (_, k) => Math.round(120 + 100 * Math.sin(k / 10))),
    throttle: Array.from({ length: N }, (_, k) => Math.max(0, Math.round(100 * Math.sin(k / 8)))),
    brake: Array.from({ length: N }, (_, k) => Math.max(0, Math.round(-100 * Math.sin(k / 8)))),
    gear: Array.from({ length: N }, (_, k) => 3 + (k % 5)),
    rpm: Array.from({ length: N }, (_, k) => Math.round((6000 + 2000 * Math.sin(k / 6)) / 10) * 10),
    steer: Array.from({ length: N }, (_, k) => Math.round(45 * Math.sin(k / 9))),
    x: Array.from({ length: N }, (_, k) => Math.round(500 * Math.cos((6.28 * k) / N))),
    y: Array.from({ length: N }, (_, k) => Math.round(500 * Math.sin((6.28 * k) / N))),
    mapSrc,
  };
  if (chans) for (const key of Object.keys(tr)) {
    if (["dist", "frac", "time", "distUnit", "len", "mapSrc"].includes(key)) continue;
    if (!chans.includes(key)) delete tr[key];
  }
  return tr;
}

const approxEq = (a, b, tol) => {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    if (a[i] == null || b[i] == null) { expect(a[i]).toBe(b[i]); continue; }
    expect(Math.abs(a[i] - b[i])).toBeLessThanOrEqual(tol);
  }
};

describe("traceCodec round-trip", () => {
  it("tüm kanallar: pack → unpack yuvarlama toleransında eşit", () => {
    const tr = synthTrace(300);
    const back = unpackTrace(packTrace(tr));
    expect(back).not.toBeNull();
    expect(back.distUnit).toBe("m");
    expect(back.len).toBeCloseTo(tr.len, 1);
    expect(back.mapSrc).toBe("pos");
    approxEq(back.time, tr.time, 0.01);      // 0.01 s ölçek
    approxEq(back.speed, tr.speed, 0.5);
    approxEq(back.throttle, tr.throttle, 0.5);
    approxEq(back.brake, tr.brake, 0.5);
    approxEq(back.gear, tr.gear, 0);
    approxEq(back.rpm, tr.rpm, 5);           // 10'a yuvarlama
    approxEq(back.steer, tr.steer, 0.5);
    approxEq(back.x, tr.x, 0.5);
    approxEq(back.y, tr.y, 0.5);
  });

  it("dist ve frac len/N'den türetilir (saklanmaz) ve doğru gelir", () => {
    const tr = synthTrace(300);
    const back = unpackTrace(packTrace(tr));
    approxEq(back.dist, tr.dist, 0.001);
    approxEq(back.frac, tr.frac, 0.0001);
  });

  it("frac birimli iz de korunur", () => {
    const tr = synthTrace(200, { distUnit: "frac", len: 1 });
    const back = unpackTrace(packTrace(tr));
    expect(back.distUnit).toBe("frac");
    approxEq(back.dist, tr.dist, 0.01);
  });

  it("null değerler korunur (boş alan sentineli)", () => {
    const tr = synthTrace(50);
    tr.throttle[10] = null; tr.throttle[20] = null; tr.x[0] = null;
    const back = unpackTrace(packTrace(tr));
    expect(back.throttle[10]).toBeNull();
    expect(back.throttle[20]).toBeNull();
    expect(back.x[0]).toBeNull();
    expect(back.throttle[11]).not.toBeNull();
  });

  it("olmayan kanal string'e yazılmaz ve unpack'te undefined kalır", () => {
    const tr = synthTrace(100, { chans: ["speed", "throttle", "brake", "x", "y"] });
    const packed = packTrace(tr);
    expect(packed).not.toContain("rp:");
    expect(packed).not.toContain("g:");
    const back = unpackTrace(packed);
    expect(back.rpm).toBeUndefined();
    expect(back.gear).toBeUndefined();
    expect(back.speed).toBeDefined();
  });
});

describe("traceCodec ↔ buildCompare uyumu", () => {
  it("unpack'lenmiş iz çifti buildCompare'da çalışır (harita + kanallar)", () => {
    const a = unpackTrace(packTrace(synthTrace(300)));
    const b = unpackTrace(packTrace(synthTrace(300, { len: 4600 })));
    const cmp = buildCompare(a, b);
    expect(cmp).not.toBeNull();
    expect(cmp.data.length).toBe(300);
    expect(cmp.chans.throttle).toBe(true);
    expect(cmp.chans.brake).toBe(true);
    expect(cmp.hasMap).toBe(true);                 // x/y geldi → harita var
    expect(cmp.data[0]).toHaveProperty("mapX");
    expect(cmp.data[0]).toHaveProperty("thA");
    expect(Number.isFinite(cmp.totalDelta)).toBe(true);
  });

  it("harita kanalı olmayan iz: hasMap false ama grafikler yine gelir", () => {
    const a = unpackTrace(packTrace(synthTrace(200, { chans: ["speed", "throttle", "brake"] })));
    const b = unpackTrace(packTrace(synthTrace(200, { chans: ["speed", "throttle", "brake"] })));
    const cmp = buildCompare(a, b);
    expect(cmp.hasMap).toBe(false);
    expect(cmp.chans.throttle).toBe(true);
  });

  /* useTelemetry.persistTraces (yazma) ↔ yükleme effect'i (okuma) format sözleşmesi.
     Biri değişirse bu test kırılır — kalıcı iz akışının bel kemiği. */
  it("Firebase teleTrace payload round-trip: persist yapısı → load → buildCompare", () => {
    // persistTraces'in Firebase'e yazdığı yapı (teams/{tid}/teleTrace/{rid}/{slot})
    const packed = [synthTrace(300), synthTrace(300, { len: 4600 })].map(packTrace);
    const payload = {
      meta: { at: Date.now(), laps: [{ sec: 90, lap: 1, partial: false }, { sec: 91, lap: 2, partial: false }], n: 2, mapSrc: "pos" },
      lap: { 0: packed[0], 1: packed[1] },
    };
    // yükleme effect'inin yaptığı: lap anahtarlarını sırala → unpack → traces
    const keys = Object.keys(payload.lap).map(Number).filter(Number.isInteger).sort((a, b) => a - b);
    const traces = keys.map((k) => unpackTrace(payload.lap[k]));
    expect(traces.every(Boolean)).toBe(true);
    expect(payload.meta.laps.length).toBe(traces.length);
    // kayıtlı iki iz doğrudan buildCompare'a → harita + gaz/fren gelir
    const cmp = buildCompare(traces[0], traces[1]);
    expect(cmp).not.toBeNull();
    expect(cmp.hasMap).toBe(true);
    expect(cmp.data.length).toBe(300);
    expect(cmp.chans.brake).toBe(true);
  });
});

describe("traceCodec sağlamlık + boyut", () => {
  it("geçersiz girdilerde güvenli döner", () => {
    expect(packTrace(null)).toBe("");
    expect(packTrace({})).toBe("");
    expect(packTrace({ time: [] })).toBe("");
    expect(unpackTrace("")).toBeNull();
    expect(unpackTrace("bozuk")).toBeNull();
    expect(unpackTrace("9;300;m;100;")).toBeNull();  // yanlış sürüm
    expect(unpackTrace(null)).toBeNull();
  });

  it("time'ı olmayan string reddedilir", () => {
    // sadece hız kanalı olan (time yok) → unpack null
    expect(unpackTrace("1;3;m;100;\nsp:1,2,3")).toBeNull();
  });

  it("300 nokta tam kanal iz Firebase yaprak sınırının altında", () => {
    const packed = packTrace(synthTrace(300));
    expect(packed.length).toBeLessThan(MAX_TRACE_STR);
  });
});
