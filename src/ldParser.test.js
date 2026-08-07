import { describe, it, expect } from "vitest";
import { parseLd } from "./ldParser";

/* Sentetik minimal MoTeC .ld kurucusu — parseLd'yi gerçek dosya gerektirmeden test eder.
   Başlık (meta_ptr@8, data_ptr@12) + 84 baytlık bağlı-liste kanal blokları + veri.
   dtype 4=int32, 2=int16; fiziksel = ham/scale·10^(−dec)·mul+shift. */
function buildLd(channels, headerStrings = {}) {
  const META = 0x200;                 // kanal meta başlangıcı
  const DATA = 0x800;                 // veri başlangıcı
  const size = DATA + channels.reduce((a, c) => a + c.raw.length * (c.dtype === 4 ? 4 : 2), 0) + 16;
  const buf = new ArrayBuffer(size);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  dv.setUint32(0, 0x40, true);
  dv.setUint32(8, META, true);
  dv.setUint32(12, DATA, true);
  const putStr = (off, s) => { for (let i = 0; i < s.length; i++) u8[off + i] = s.charCodeAt(i); };
  if (headerStrings.date) putStr(0x5e, headerStrings.date);
  if (headerStrings.driver) putStr(0x9e, headerStrings.driver);
  if (headerStrings.venue) putStr(0x15e, headerStrings.venue);

  let dataOff = DATA;
  channels.forEach((c, i) => {
    const meta = META + i * 84;
    const next = i < channels.length - 1 ? META + (i + 1) * 84 : 0;
    dv.setUint32(meta + 4, next, true);
    dv.setUint32(meta + 8, dataOff, true);           // data_addr
    dv.setUint32(meta + 12, c.raw.length, true);     // n_data
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

/* 10 Hz, 2 tur: tur 1 = 60 sn (i=0..599), tur 2 = 45 sn (i=600..1049). */
const L1 = 600, N = 1050, FREQ = 10;
function twoLapChannels() {
  const lapRaw = Array.from({ length: N }, (_, i) => (i < L1 ? 1 : 2));           // Lap Number (int16, identity)
  const eltRaw = Array.from({ length: N }, (_, i) => i * 100);                    // ELT ms (int32, dec=3 → sn)
  const fuelRaw = Array.from({ length: N }, (_, i) => 50000 - i * 30);            // Fuel mL (int32, dec=3 → L): monoton azalır
  const wearRaw = Array.from({ length: N }, (_, i) => i * 5);                     // Wear (int32, dec=2 → %): 0→~5.2
  const spdRaw = Array.from({ length: N }, (_, i) => (i < L1 ? 20000 : 24000));   // Speed (int32, dec=2 → km/h): 200 / 240
  return [
    { name: "Lap Number", dtype: 2, freq: FREQ, raw: lapRaw },
    { name: "Session Elapsed Time", dtype: 4, freq: FREQ, dec: 3, raw: eltRaw },
    { name: "Fuel Level", dtype: 4, freq: FREQ, dec: 3, raw: fuelRaw },
    { name: "Tyre Wear FL", dtype: 4, freq: FREQ, dec: 2, raw: wearRaw },
    { name: "Tyre Wear FR", dtype: 4, freq: FREQ, dec: 2, raw: wearRaw },
    { name: "Tyre Wear RL", dtype: 4, freq: FREQ, dec: 2, raw: wearRaw },
    { name: "Tyre Wear RR", dtype: 4, freq: FREQ, dec: 2, raw: wearRaw },
    { name: "Ground Speed", dtype: 4, freq: FREQ, dec: 2, raw: spdRaw },
  ];
}

describe("parseLd", () => {
  it("iki turu segmentler, süre/yakıt/aşınma/hız çıkarır", () => {
    const buf = buildLd(twoLapChannels(), { date: "01/01/2026", driver: "Test Sürücü", venue: "Test Pisti" });
    const r = parseLd(buf);
    expect(r.error).toBeUndefined();
    expect(r.motec).toBe(true);
    expect(r.laps.length).toBe(2);
    expect(r.laps.map((l) => l.lap)).toEqual([1, 2]);
    // tur 1 = 60 sn (sonraki turun başına kadar)
    expect(r.laps[0].sec).toBeCloseTo(60.0, 0);
    expect(r.laps[0].span).toBeCloseTo(60.0, 0);
    // yakıt tüketimi pozitif (fuel monoton azalıyor)
    expect(r.laps[0].fuelL).toBeGreaterThan(0);
    // aşınma pozitif ve ~ölçekli (dec=2)
    expect(r.laps[0].w[0]).toBeGreaterThan(0);
    expect(r.laps[0].w.filter((x) => x != null).length).toBe(4);
    // hız ölçeği doğru: tur 1 ~200 km/h
    expect(r.laps[0].maxSpd).toBeCloseTo(200, 0);
    expect(r.laps[1].maxSpd).toBeCloseTo(240, 0);
    // meta başlık string'leri
    expect(r.meta.driver).toBe("Test Sürücü");
    expect(r.meta.venue).toBe("Test Pisti");
    expect(r.meta.date).toBe("01/01/2026");
  });

  it("int16 ve ölçek (mul/dec) doğru çözülür — ELT dec=3 saniyeye çevirir", () => {
    const buf = buildLd(twoLapChannels());
    const r = parseLd(buf);
    // ELT dec=3: ms→sn dönüşümü çalışıyorsa tur 1 ≈ 60 sn; ham ms okunsaydı 60000 olurdu
    expect(r.laps[0].sec).toBeGreaterThan(30);
    expect(r.laps[0].sec).toBeLessThan(120);
  });

  it("bozuk/küçük buffer → error (çökmez)", () => {
    expect(parseLd(new ArrayBuffer(8)).error).toBeTruthy();
    // geçerli başlık ama kanal yok
    const empty = new ArrayBuffer(0x300);
    new DataView(empty).setUint32(8, 0x200, true);
    const r = parseLd(empty);
    expect(r.error).toBeTruthy();
  });

  it("Lap Number / zaman kanalı yoksa error", () => {
    const buf = buildLd([{ name: "Ground Speed", dtype: 4, freq: 10, dec: 2, raw: [20000, 20000, 20000, 20000, 20000] }]);
    const r = parseLd(buf);
    expect(r.error).toBeTruthy();
  });
});
