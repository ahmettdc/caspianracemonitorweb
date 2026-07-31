import { describe, it, expect } from "vitest";
import { newFuelObs, fuelObserve } from "./fuelObs.js";

/* Canlı yakıt öğrenici — köprü ~2.5 Hz kare gönderir, turlar ~2 dakikadır.
   Regresyon: tüketim TUR SINIRINDA mandallanan yakıttan ölçülmeli. Eskiden
   prevFuel her karede güncelleniyordu → ölçülen delta 0.4 saniyenin yakıtı
   (~0.01 L) oluyor, makuliyet filtresine (>0.2 L) takılıp HİÇ örnek toplanmıyordu. */

const DT = 0.4;          // köprü kare aralığı (2.5 Hz)
const LAP = 120;         // tur süresi (sn)
const CAP = 100;         // depo (L)

/* Gerçekçi bir stint sür: sabit tüketimle nLaps tur. */
function drive(ref, { laps, perLap, startFuel = CAP, cap = CAP }) {
  let out = null;
  const total = LAP * laps;
  for (let tSec = 0; tSec <= total; tSec += DT) {
    const fuel = startFuel - (tSec / LAP) * perLap;
    out = fuelObserve(ref, {
      fuel: +fuel.toFixed(3), fuelCapacity: cap, lapsDone: Math.floor(tSec / LAP),
    });
  }
  return out;
}

describe("fuelObserve", () => {
  it("gerçekçi akışta tur tüketimini öğrenir (~3 L/tur)", () => {
    const ref = newFuelObs();
    const obs = drive(ref, { laps: 8, perLap: 3.0 });
    expect(obs.samples).toBeGreaterThanOrEqual(5);
    expect(obs.litersPerLap).toBeGreaterThan(2.9);
    expect(obs.litersPerLap).toBeLessThan(3.1);
  });

  it("regresyon: eski kare-kare mantığı hiç örnek toplayamıyordu", () => {
    // eski davranışın simülasyonu — prevFuel HER karede güncelleniyor
    const r = { prevLap: null, prevFuel: null, buf: [] };
    for (let tSec = 0; tSec <= LAP * 8; tSec += DT) {
      const fuel = CAP - (tSec / LAP) * 3.0;
      const lap = Math.floor(tSec / LAP);
      if (r.prevLap != null && lap > r.prevLap && r.prevFuel != null) {
        const perLap = (r.prevFuel - fuel) / (lap - r.prevLap);
        if (perLap > 0.2 && perLap < 30) r.buf.push(perLap);
      }
      r.prevLap = lap; r.prevFuel = fuel;
    }
    expect(r.buf.length).toBe(0);                       // eski: hiç örnek yok
    const obs = drive(newFuelObs(), { laps: 8, perLap: 3.0 });
    expect(obs.samples).toBeGreaterThan(0);             // yeni: öğreniyor
  });

  it("VE %/tur ve depo oranını türetir", () => {
    const obs = drive(newFuelObs(), { laps: 6, perLap: 3.0, cap: 86 });
    expect(obs.fuelCap).toBe(86);
    expect(obs.obsRatio).toBeCloseTo(0.86, 3);
    expect(obs.obsCons).toBeCloseTo(3.0 / 0.86, 1);     // %/tur
  });

  it("pit dolumu (yakıt artışı) örnek olarak sayılmaz", () => {
    const ref = newFuelObs();
    fuelObserve(ref, { fuel: 50, fuelCapacity: CAP, lapsDone: 5 });   // tur başı: 50 L
    // pit turu: depo doldu (50 → 95) → tüketim negatif, örnek olmamalı
    fuelObserve(ref, { fuel: 95, fuelCapacity: CAP, lapsDone: 6 });
    expect(ref.buf.length).toBe(0);
    // dolum sonrası normal tur yine öğrenilmeli (mandal yenilendi: 95 → 92)
    fuelObserve(ref, { fuel: 92, fuelCapacity: CAP, lapsDone: 7 });
    expect(ref.buf).toEqual([3]);
  });

  it("anomali (>30 L/tur) elenir", () => {
    const ref = newFuelObs();
    fuelObserve(ref, { fuel: 100, fuelCapacity: CAP, lapsDone: 1 });
    fuelObserve(ref, { fuel: 20, fuelCapacity: CAP, lapsDone: 2 });   // 80 L/tur
    expect(ref.buf.length).toBe(0);
  });

  it("tampon son 6 turla sınırlı (medyan taze kalır)", () => {
    const ref = newFuelObs();
    drive(ref, { laps: 12, perLap: 3.0, startFuel: 200, cap: 200 });
    expect(ref.buf.length).toBeLessThanOrEqual(6);
  });

  it("veri yoksa null; depo varsa yalnız oran döner", () => {
    expect(fuelObserve(newFuelObs(), null)).toBe(null);
    expect(fuelObserve(newFuelObs(), { fuel: "x" })).toBe(null);
    const only = fuelObserve(newFuelObs(), { fuel: 50, fuelCapacity: 0, lapsDone: 1 });
    expect(only).toBe(null);                             // örnek de depo da yok
    const cap = fuelObserve(newFuelObs(), { fuel: 50, fuelCapacity: 90, lapsDone: 1 });
    expect(cap.litersPerLap).toBe(null);
    expect(cap.obsRatio).toBeCloseTo(0.9, 3);
  });
});
