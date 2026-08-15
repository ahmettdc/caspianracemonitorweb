import { describe, it, expect } from "vitest";
import { newLapObs, lapObserve, hasWrites } from "./lapObs.js";

/* Bir kare kurucu: alan başına lapKey/lapsDone/lastSec/lastSectors + session. */
const frame = (rows, session = { sessionId: "10", sessionType: "Yarış", trackTemp: 30, wetness: 5 }) =>
  ({ ts: 1, session, field: rows });
const car = (key, laps, last, secs) =>
  ({ lapKey: key, lapsDone: laps, lastSec: last, lastSectors: secs });

describe("lapObserve — okuyucu-tarafı tur hasadı", () => {
  it("ilk görüş YAZMAZ (yalnız prevLaps'i mandalla)", () => {
    const s = newLapObs();
    const { writes, captured } = lapObserve(s, frame([car("c5", 18, 141.2)]));
    expect(hasWrites(writes.livelaps)).toBe(false);
    expect(captured).toBe(0);
  });

  it("tek artış → o turu lastSec ile yazar", () => {
    const s = newLapObs();
    lapObserve(s, frame([car("c5", 18, 141.2)]));               // ilk görüş
    const { writes, captured, cars } = lapObserve(s, frame([car("c5", 19, 140.8)]));
    expect(writes.livelaps).toEqual({ "c5/19": 140.8 });
    expect(captured).toBe(1);
    expect(cars).toBe(1);
  });

  it("aynı kareyi tekrar gözlem → boş (idempotent)", () => {
    const s = newLapObs();
    lapObserve(s, frame([car("c5", 18, 141.2)]));
    lapObserve(s, frame([car("c5", 19, 140.8)]));
    const { writes } = lapObserve(s, frame([car("c5", 19, 140.8)]));
    expect(hasWrites(writes.livelaps)).toBe(false);
  });

  it("lastSec ≤ 0 → yazmaz ama prevLaps ilerler", () => {
    const s = newLapObs();
    lapObserve(s, frame([car("c5", 18, 141.2)]));
    const { writes } = lapObserve(s, frame([car("c5", 19, -1)]));
    expect(hasWrites(writes.livelaps)).toBe(false);
    // sonraki gerçek tur normal yazılır
    const r2 = lapObserve(s, frame([car("c5", 20, 139.5)]));
    expect(r2.writes.livelaps).toEqual({ "c5/20": 139.5 });
  });

  it("lapsDone atlaması → yalnız ÜST turu yazar (reader limiti)", () => {
    const s = newLapObs();
    lapObserve(s, frame([car("c5", 18, 141.2)]));
    const { writes } = lapObserve(s, frame([car("c5", 21, 140.0)]));  // 3 tur atladı
    expect(writes.livelaps).toEqual({ "c5/21": 140.0 });             // yalnız 21
  });

  it("livesec + livecond yazılır (sektör üçlüsü + koşul dizesi)", () => {
    const s = newLapObs();
    lapObserve(s, frame([car("c5", 18, 141.2, [40, 62, 39])]));
    const { writes } = lapObserve(s, frame([car("c5", 19, 140.8, [39.5, 61.5, 39.8])]));
    expect(writes.livesec).toEqual({ "c5/19": "39.5,61.5,39.8" });
    // livecond = "trackTemp,wetness,grip" (grip rubberPct'ten; sayısal, formatı doğrula)
    expect(writes.livecond["c5/19"]).toMatch(/^30,5,\d+$/);
  });

  it("eksik/geçersiz sektör → livesec yazılmaz, livelaps yine yazılır", () => {
    const s = newLapObs();
    lapObserve(s, frame([car("c5", 18, 141.2)]));                    // lastSectors yok
    const { writes } = lapObserve(s, frame([car("c5", 19, 140.8, [40, 0, 39])]));
    expect(writes.livelaps).toEqual({ "c5/19": 140.8 });
    expect(hasWrites(writes.livesec)).toBe(false);                  // bir sektör 0
  });

  it("sessionId değişimi → clears.all (ama İLK sid'de DEĞİL)", () => {
    const s = newLapObs();
    const first = lapObserve(s, frame([car("c5", 5, 141)], { sessionId: "1" }));
    expect(first.clears.all).toBe(false);                           // ilk sid: temizleme yok
    const swap = lapObserve(s, frame([car("c9", 2, 145)], { sessionId: "10" }));
    expect(swap.clears.all).toBe(true);                            // seans değişti → temizle
  });

  it("sessionId aynı kaldıkça temizleme yok", () => {
    const s = newLapObs();
    lapObserve(s, frame([car("c5", 5, 141)]));
    const r = lapObserve(s, frame([car("c5", 6, 140)]));
    expect(r.clears.all).toBe(false);
    expect(r.clears.keys).toEqual([]);
  });

  it("araç gerilemesi (reset) → o aracın anahtarını temizle", () => {
    const s = newLapObs();
    lapObserve(s, frame([car("c5", 18, 141)]));
    const r = lapObserve(s, frame([car("c5", 3, 150)]));            // 18 → 3 (araç sıfırlandı)
    expect(r.clears.keys).toEqual(["c5"]);
    expect(hasWrites(r.writes.livelaps)).toBe(false);
  });

  it("lobi-restart debounce: tek 0-karesi temizlemez, ZERO_FRAMES sonra temizler", () => {
    const s = newLapObs();
    lapObserve(s, frame([car("c5", 4, 141)]));                     // prevMax=4
    const f0 = () => frame([car("c5", 0, -1)]);
    const a = lapObserve(s, f0());
    expect(a.clears.all).toBe(false);                             // 1. sıfır kare
    const b = lapObserve(s, f0());
    expect(b.clears.all).toBe(true);                             // 2. → debounce doldu
  });

  it("field yok/boş → güvenli boş sonuç", () => {
    const s = newLapObs();
    const r = lapObserve(s, { ts: 1, session: {} });
    expect(hasWrites(r.writes.livelaps)).toBe(false);
    expect(r.cars).toBe(0);
  });

  it("lapKey olmayan satırlar atlanır (demo/eski kare)", () => {
    const s = newLapObs();
    lapObserve(s, frame([{ lapsDone: 18, lastSec: 141 }]));         // lapKey yok
    const r = lapObserve(s, frame([{ lapsDone: 19, lastSec: 140 }]));
    expect(hasWrites(r.writes.livelaps)).toBe(false);
    expect(r.cars).toBe(0);
  });
});
