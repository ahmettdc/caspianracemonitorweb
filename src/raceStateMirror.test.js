/* Yarış-durumu YEREL aynası (raceStateMirrorSave/Load) — cihaz-yerel dayanıklılık.
   Amaç: Firebase yazımı 800 ms debounce'lu ve masaüstü penceresi kapanınca uçuşan
   yazım tamamlanmadan süreç ölebiliyor; ayna her düzenlemeyi SENKRON localStorage'a
   yazar → yeniden açılışta veri kaybolmaz.

   Uzlaştırma REV tabanlıdır (zaman damgası DEĞİL): yerel ayna yalnız GÖNDERİLMEMİŞ
   (dirty) VE uzak sürümle AYNI rev üzerine yapılmışsa geri yüklenir. Bu test
   round-trip + guard'ları + openRace'in karar kuralını doğrular.

   NOT: Bu depo testlerde jsdom kullanmaz (render testleri renderToStaticMarkup ile
   çalışır) → node ortamında minimal bir localStorage stub'ı kurulur. */
import { describe, it, expect, beforeEach } from "vitest";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
  setItem: (k, v) => store.set(String(k), String(v)),
  removeItem: (k) => store.delete(String(k)),
  clear: () => store.clear(),
  get length() { return store.size; },
};

const { raceStateMirrorSave, raceStateMirrorLoad } = await import("./storage.js");

/* openRace'teki uzlaştırma kararının birebir kopyası (App.jsx):
   canEditTeam && remote && mirror && mirror.dirty && mirror.rev === (remote.rev||0) */
const useMirror = (canEdit, remote, mirror) =>
  !!(canEdit && remote && mirror && mirror.dirty && mirror.rev === (remote.rev || 0));

describe("raceState yerel aynası", () => {
  beforeEach(() => localStorage.clear());

  it("kaydedip geri okur (round-trip)", () => {
    const json = JSON.stringify({ avgLap: "1:47.70" });
    raceStateMirrorSave("t1", "r2", json, 7, true);
    expect(raceStateMirrorLoad("t1", "r2")).toEqual({ stateJson: json, rev: 7, dirty: true });
  });

  it("yarış/takım başına ayrı anahtar", () => {
    raceStateMirrorSave("t1", "r2", "{\"a\":1}", 3, true);
    raceStateMirrorSave("t1", "r3", "{\"a\":2}", 4, false);
    expect(raceStateMirrorLoad("t1", "r2").stateJson).toBe("{\"a\":1}");
    expect(raceStateMirrorLoad("t1", "r3").stateJson).toBe("{\"a\":2}");
  });

  it("kayıt yoksa null döner", () => {
    expect(raceStateMirrorLoad("t1", "yok")).toBeNull();
  });

  it("bozuk/eksik kayıt null döner (çökmeden)", () => {
    localStorage.setItem("rm_rstate_t1_r2", "{bozuk json");
    expect(raceStateMirrorLoad("t1", "r2")).toBeNull();
    localStorage.setItem("rm_rstate_t1_r3", JSON.stringify({ stateJson: "{}" }));  // rev yok
    expect(raceStateMirrorLoad("t1", "r3")).toBeNull();
  });

  it("eksik tid/rid ya da string olmayan stateJson yazmaz", () => {
    raceStateMirrorSave("", "r2", "{}", 1, true);
    raceStateMirrorSave("t1", "", "{}", 1, true);
    raceStateMirrorSave("t1", "r2", null, 1, true);
    expect(localStorage.length).toBe(0);
  });

  it("rev verilmezse 0, dirty boolean'a çevrilir", () => {
    raceStateMirrorSave("t1", "r2", "{}");
    expect(raceStateMirrorLoad("t1", "r2")).toEqual({ stateJson: "{}", rev: 0, dirty: false });
  });

  describe("uzlaştırma kararı (rev tabanlı)", () => {
    it("dirty + rev eşit → yereli geri yükle (gönderilmemiş düzenleme kurtarılır)", () => {
      raceStateMirrorSave("t1", "r2", "{\"avgLap\":\"1:47.70\"}", 5, true);
      const m = raceStateMirrorLoad("t1", "r2");
      expect(useMirror(true, { rev: 5, stateJson: "x" }, m)).toBe(true);
    });

    it("başka cihaz sunucuyu ilerletti (remote.rev > mirror.rev) → yereli ATLA (ezme yok)", () => {
      raceStateMirrorSave("t1", "r2", "{\"avgLap\":\"1:47.51\"}", 5, true);
      const m = raceStateMirrorLoad("t1", "r2");
      expect(useMirror(true, { rev: 8, stateJson: "x" }, m)).toBe(false);
    });

    it("ayna temiz (dirty:false) → yereli atla, uzak kullan", () => {
      raceStateMirrorSave("t1", "r2", "{}", 5, false);
      const m = raceStateMirrorLoad("t1", "r2");
      expect(useMirror(true, { rev: 5, stateJson: "x" }, m)).toBe(false);
    });

    it("uzak okuma başarısız (remote yok) → yereli KULLANMA (soğuk açılış eskime bug'ı)", () => {
      raceStateMirrorSave("t1", "r2", "{}", 5, true);
      const m = raceStateMirrorLoad("t1", "r2");
      expect(useMirror(true, null, m)).toBe(false);
      expect(useMirror(true, undefined, m)).toBe(false);
    });

    it("viewer (canEdit false) → yereli kullanma", () => {
      raceStateMirrorSave("t1", "r2", "{}", 5, true);
      const m = raceStateMirrorLoad("t1", "r2");
      expect(useMirror(false, { rev: 5 }, m)).toBe(false);
    });

    it("ayna yok → uzak kullan", () => {
      expect(useMirror(true, { rev: 0 }, null)).toBe(false);
    });
  });
});
