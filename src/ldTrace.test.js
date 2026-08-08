import { describe, it, expect } from "vitest";
import { parseLd } from "./ldParser";
import { buildReaders, buildTrace, buildCompare, sectorOf, sectorMarks } from "./ldTrace";

describe("sectorOf / sectorMarks", () => {
  it("sectorOf: kesir → 1..3", () => {
    expect(sectorOf(0)).toBe(1);
    expect(sectorOf(0.33)).toBe(1);
    expect(sectorOf(0.34)).toBe(2);
    expect(sectorOf(0.66)).toBe(2);
    expect(sectorOf(0.67)).toBe(3);
    expect(sectorOf(1)).toBe(3);          // tam son → S3 (klamp)
    expect(sectorOf(NaN)).toBe(1);
  });
  it("sectorMarks: iki sınır (N/3, 2N/3)", () => {
    const data = Array.from({ length: 600 }, (_, i) => ({ d: i }));
    const m = sectorMarks(data);
    expect(m).toHaveLength(2);
    expect(m[0].idx).toBe(200);
    expect(m[1].idx).toBe(400);
    expect(m[0].label).toBe("S1|S2");
    expect(m[1].label).toBe("S2|S3");
    expect(m[0].d).toBe(200);
  });
  it("sectorMarks: kısa/boş veri → boş", () => {
    expect(sectorMarks([])).toEqual([]);
    expect(sectorMarks([{ d: 0 }, { d: 1 }])).toEqual([]);
  });
});

/* Sentetik .ld kurucusu (ldParser.test.js ile aynı düzen) — gerçek dosyasız test. */
function buildLd(channels) {
  const META = 0x200, DATA = 0x800;
  const size = DATA + channels.reduce((a, c) => a + c.raw.length * (c.dtype === 4 ? 4 : 2), 0) + 16;
  const buf = new ArrayBuffer(size);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  dv.setUint32(0, 0x40, true); dv.setUint32(8, META, true); dv.setUint32(12, DATA, true);
  const putStr = (off, s) => { for (let i = 0; i < s.length; i++) u8[off + i] = s.charCodeAt(i); };
  let dataOff = DATA;
  channels.forEach((c, i) => {
    const meta = META + i * 84;
    dv.setUint32(meta + 4, i < channels.length - 1 ? META + (i + 1) * 84 : 0, true);
    dv.setUint32(meta + 8, dataOff, true);
    dv.setUint32(meta + 12, c.raw.length, true);
    dv.setUint16(meta + 20, c.dtype, true);
    dv.setUint16(meta + 22, c.freq, true);
    dv.setInt16(meta + 24, c.shift || 0, true);
    dv.setInt16(meta + 26, c.mul || 1, true);
    dv.setInt16(meta + 28, c.scale || 1, true);
    dv.setInt16(meta + 30, c.dec || 0, true);
    putStr(meta + 32, c.name);
    for (const r of c.raw) {
      if (c.dtype === 4) { dv.setInt32(dataOff, r, true); dataOff += 4; }
      else { dv.setInt16(dataOff, r, true); dataOff += 2; }
    }
  });
  return buf;
}

/* 10 Hz, 2 tur: tur1 = 60sn @200km/h, tur2 = 45sn @240km/h. Gaz 0.5 (0..1) → %50. */
const L1 = 600, N = 1050, FREQ = 10;
function chans({ withSpeed = true, withDist = false } = {}) {
  const base = [
    { name: "Lap Number", dtype: 2, freq: FREQ, raw: Array.from({ length: N }, (_, i) => (i < L1 ? 1 : 2)) },
    { name: "Session Elapsed Time", dtype: 4, freq: FREQ, dec: 3, raw: Array.from({ length: N }, (_, i) => i * 100) },
    { name: "Throttle Pos", dtype: 2, freq: FREQ, dec: 2, raw: Array.from({ length: N }, () => 50) },   // 0.50 → %50
    { name: "Brake Pos", dtype: 2, freq: FREQ, dec: 2, raw: Array.from({ length: N }, () => 0) },
    { name: "Gear", dtype: 2, freq: FREQ, raw: Array.from({ length: N }, () => 4) },
  ];
  if (withSpeed) base.push({ name: "Ground Speed", dtype: 4, freq: FREQ, dec: 2, raw: Array.from({ length: N }, (_, i) => (i < L1 ? 20000 : 24000)) });
  if (withDist) base.push({ name: "Lap Distance", dtype: 4, freq: FREQ, dec: 1, raw: Array.from({ length: N }, (_, i) => (i < L1 ? i : i - L1) * 50) });
  return base;
}

describe("ldTrace", () => {
  it("buildTrace: mesafe ızgarasında hız/gaz/vites izi (hız entegrasyonu)", async () => {
    const r = await parseLd(buildLd(chans()));
    const readers = await buildReaders(new Blob([buildLd(chans())]), r._header);
    // not: readers'ı yeni Blob'tan kur (r'nin dosyası yok); header aynı
    const tr = buildTrace(readers, r.laps[0], 200);
    expect(tr).toBeTruthy();
    expect(tr.dist.length).toBe(200);
    expect(tr.speed.length).toBe(200);
    expect(tr.distUnit).toBe("m");
    // 200 km/h × 60 sn ≈ 3333 m tur uzunluğu
    expect(tr.len).toBeGreaterThan(2500);
    expect(tr.len).toBeLessThan(4000);
    // zaman monoton artan, tur başından ~0..60
    expect(tr.time[0]).toBeCloseTo(0, 1);
    expect(tr.time[tr.time.length - 1]).toBeGreaterThan(50);
    for (let i = 1; i < tr.time.length; i++) expect(tr.time[i]).toBeGreaterThanOrEqual(tr.time[i - 1] - 1e-6);
    // gaz 0..1 → %50'ye ölçeklenir
    expect(tr.throttle[100]).toBeCloseTo(50, 0);
    // vites yuvarlanır
    expect(tr.gear[100]).toBe(4);
  });

  it("buildCompare: delta uç değeri ≈ tur süre farkı; sektörler + kanal envanteri", async () => {
    const buf = buildLd(chans());
    const r = await parseLd(buf);
    const readers = await buildReaders(new Blob([buf]), r._header);
    const a = buildTrace(readers, r.laps[0], 300);   // 60 sn tur
    const b = buildTrace(readers, r.laps[1], 300);   // 45 sn tur
    const cmp = buildCompare(a, b);
    expect(cmp.data.length).toBe(300);
    expect(cmp.chans.speed).toBe(true);
    expect(cmp.chans.throttle).toBe(true);
    // kesir-hizalı delta: uçta B ~15 sn daha hızlı → totalDelta ≈ -15
    expect(cmp.totalDelta).toBeLessThan(-10);
    expect(cmp.totalDelta).toBeGreaterThan(-20);
    // sektör farkları (üçlü): her biri negatif (B hızlı), toplam ≈ totalDelta
    expect(cmp.sectors.length).toBe(3);
    const sum = cmp.sectors.reduce((s, x) => s + x.diff, 0);
    expect(sum).toBeCloseTo(cmp.totalDelta, 1);
  });

  it("mesafe kanalı varsa onu kullanır (distUnit m)", async () => {
    const buf = buildLd(chans({ withDist: true }));
    const r = await parseLd(buf);
    const readers = await buildReaders(new Blob([buf]), r._header);
    const tr = buildTrace(readers, r.laps[0], 150);
    expect(tr.distUnit).toBe("m");
    expect(tr.len).toBeGreaterThan(0);
  });

  it("ne hız ne mesafe → tur-kesri yedeği (distUnit frac)", async () => {
    const buf = buildLd(chans({ withSpeed: false }));
    const r = await parseLd(buf);
    const readers = await buildReaders(new Blob([buf]), r._header);
    const tr = buildTrace(readers, r.laps[0], 120);
    expect(tr.distUnit).toBe("frac");
    expect(tr.dist[tr.dist.length - 1]).toBeCloseTo(100, 0);   // 0..100 (%)
  });

  it("buildTrace: okuyucu/tur yoksa null", () => {
    expect(buildTrace(null, { t0: 0, tEnd: 10 })).toBe(null);
    expect(buildTrace({ speed: null }, { t0: 0, tEnd: 10 })).toBe(null);
  });

  it("pist şekli: yanal-G'den türetir (mapSrc g) + buildCompare hasMap", async () => {
    const c = [...chans(),
      { name: "G Force Lat", dtype: 2, freq: FREQ, dec: 2, raw: Array.from({ length: N }, () => 100) }]; // 1.0 g sabit dönüş
    const buf = buildLd(c);
    const r = await parseLd(buf);
    const readers = await buildReaders(new Blob([buf]), r._header);
    const tr = buildTrace(readers, r.laps[0], 200);
    expect(tr.mapSrc).toBe("g");
    expect(tr.x.length).toBe(200);
    expect(Math.max(...tr.x) - Math.min(...tr.x)).toBeGreaterThan(0);   // dönüş → şekil oluştu
    const cmp = buildCompare(tr, buildTrace(readers, r.laps[1], 200));
    expect(cmp.hasMap).toBe(true);
    expect(cmp.mapSrc).toBe("g");
    expect(cmp.data[100].mapX).not.toBeNull();
  });

  it("pist şekli: konum kanalı varsa onu kullanır (mapSrc pos)", async () => {
    const c = [...chans(),
      { name: "Car Coord X", dtype: 4, freq: FREQ, raw: Array.from({ length: N }, (_, i) => Math.round(Math.cos(i / 50) * 100)) },
      { name: "Car Coord Z", dtype: 4, freq: FREQ, raw: Array.from({ length: N }, (_, i) => Math.round(Math.sin(i / 50) * 100)) }];
    const buf = buildLd(c);
    const r = await parseLd(buf);
    const readers = await buildReaders(new Blob([buf]), r._header);
    const tr = buildTrace(readers, r.laps[0], 150);
    expect(tr.mapSrc).toBe("pos");
    expect(tr.y.length).toBe(150);
  });

  it("pist şekli: konum/G yoksa harita yok (hasMap false)", async () => {
    const buf = buildLd(chans());   // yalnız hız/gaz/fren/vites, konum/G yok
    const r = await parseLd(buf);
    const readers = await buildReaders(new Blob([buf]), r._header);
    const cmp = buildCompare(buildTrace(readers, r.laps[0], 120), buildTrace(readers, r.laps[1], 120));
    expect(cmp.hasMap).toBe(false);
  });
});
