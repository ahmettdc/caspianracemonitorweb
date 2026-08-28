/* Yarış-durumu YEREL aynası (raceStateMirrorSave/Load) — cihaz-yerel dayanıklılık.
   Amaç: Firebase yazımı 800 ms debounce'lu ve masaüstü penceresi kapanınca uçuşan
   yazım tamamlanmadan süreç ölebiliyor; ayna her düzenlemeyi SENKRON localStorage'a
   yazar → yeniden açılışta veri kaybolmaz. Bu test round-trip + guard'ları doğrular
   ve openRace'in uzlaştırma kararını (mirror.at > remote.updatedAt) örnekler.

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

describe("raceState yerel aynası", () => {
  beforeEach(() => localStorage.clear());

  it("kaydedip geri okur (round-trip)", () => {
    const json = JSON.stringify({ avgLap: "1:47.70", consumption: 8.9 });
    raceStateMirrorSave("team1", "r2", json, 1000);
    const got = raceStateMirrorLoad("team1", "r2");
    expect(got).toEqual({ stateJson: json, at: 1000 });
  });

  it("yarış/takım başına ayrı anahtar", () => {
    raceStateMirrorSave("team1", "r2", "{\"a\":1}", 1);
    raceStateMirrorSave("team1", "r3", "{\"a\":2}", 2);
    expect(raceStateMirrorLoad("team1", "r2").stateJson).toBe("{\"a\":1}");
    expect(raceStateMirrorLoad("team1", "r3").stateJson).toBe("{\"a\":2}");
  });

  it("kayıt yoksa null döner", () => {
    expect(raceStateMirrorLoad("team1", "yok")).toBeNull();
  });

  it("bozuk/eksik kayıt null döner (çökmeden)", () => {
    localStorage.setItem("rm_rstate_team1_r2", "{bozuk json");
    expect(raceStateMirrorLoad("team1", "r2")).toBeNull();
    localStorage.setItem("rm_rstate_team1_r3", JSON.stringify({ stateJson: 5 }));  // at yok, stateJson sayı
    expect(raceStateMirrorLoad("team1", "r3")).toBeNull();
  });

  it("eksik tid/rid ya da string olmayan stateJson yazmaz", () => {
    raceStateMirrorSave("", "r2", "{}", 1);
    raceStateMirrorSave("team1", "", "{}", 1);
    raceStateMirrorSave("team1", "r2", null, 1);
    expect(localStorage.length).toBe(0);
  });

  it("at verilmezse Date.now ile damgalar", () => {
    const before = Date.now();
    raceStateMirrorSave("team1", "r2", "{}");
    const got = raceStateMirrorLoad("team1", "r2");
    expect(got.at).toBeGreaterThanOrEqual(before);
  });

  it("uzlaştırma kararı: yerel ayna uzak sürümden yeniyse yerel kazanır", () => {
    // openRace'teki kural: canEditTeam && mirror && mirror.at > (remote.updatedAt||0)
    const decide = (mirror, remoteUpdatedAt) => !!(mirror && mirror.at > (remoteUpdatedAt || 0));
    raceStateMirrorSave("team1", "r2", "{\"avgLap\":\"1:47.70\"}", 5000);
    const mirror = raceStateMirrorLoad("team1", "r2");
    expect(decide(mirror, 4000)).toBe(true);   // yerel daha yeni → yerel
    expect(decide(mirror, 6000)).toBe(false);  // uzak daha yeni → uzak
    expect(decide(mirror, 5000)).toBe(false);  // eşit → uzak (senkron sayılır)
    expect(decide(null, 0)).toBe(false);       // ayna yok → uzak
  });
});
