/* REGRESYON (v2.4.1) — SEANS SÜRESİ "EN ÇOK ÖRNEKLİ" KANALDAN HESAPLANIYORDU.
   Saat (GPS Time) kanalı bulunamadığında seans süresi sürekli kanallardan
   türetiliyor. Seçim ÖRNEK SAYISINA göre yapılıyor ve süre `uzunluk / hz` diye
   hesaplanıyordu; oysa yorumun kendisi "en uzun sürekli kanaldan" diyor.
   Yüksek frekanslı ama kısa bir kanal, düşük frekanslı uzun bir kanalı yeniyor
   ve süreyi yarıya düşürüyordu → tEnd erken, son turun izi kırpılıyor,
   duckMeta orta-seans sıcaklığını yanlış noktadan örnekliyordu. */
import { describe, it, expect } from "vitest";
import { longestContSec } from "./duckdb.js";

describe("longestContSec — SÜRE'ye göre seçer, örnek sayısına göre değil", () => {
  it("yüksek frekanslı KISA kanal, düşük frekanslı UZUN kanalı yenemez", () => {
    const cont = {
      rpm: { hz: 100, v: Array.from({ length: 12000 }) },     // 120 sn — daha ÇOK örnek
      speed: { hz: 10, v: Array.from({ length: 2400 }) },     // 240 sn — daha UZUN
    };
    expect(longestContSec(cont)).toBe(240);
    // eski hesap (en çok örnekli): 12000 / 100 = 120 → yarısı
    expect(longestContSec(cont)).not.toBe(120);
  });

  it("tek kanal / eşit frekans doğal sonucu verir", () => {
    expect(longestContSec({ speed: { hz: 10, v: Array.from({ length: 300 }) } })).toBe(30);
    expect(longestContSec({
      a: { hz: 10, v: Array.from({ length: 100 }) }, b: { hz: 10, v: Array.from({ length: 250 }) },
    })).toBe(25);
  });

  it("bozuk/eksik kanal atlanır, çökmez (uydurma süre yok)", () => {
    expect(longestContSec(null)).toBe(0);
    expect(longestContSec({})).toBe(0);
    expect(longestContSec({ a: null, b: { hz: 0, v: Array.from({ length: 10 }) },
      c: { hz: 10, v: [] }, d: { hz: NaN, v: Array.from({ length: 5 }) } })).toBe(0);
  });
});
