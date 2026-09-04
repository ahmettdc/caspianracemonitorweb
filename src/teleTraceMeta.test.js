/* REGRESYON (v2.4.1) — KALICI İZ META'SI İKİ FARKLI ŞEKİLDEYDİ.
   Yazan taraf düğüme {at, laps, n, mapSrc, capped} yazıp oturum-içi state'e
   SEANS meta'sını ({venue, vehicle, driver, trk, amb}) koyuyor; okuyan taraf
   geri yüklerken DÜĞÜM meta'sını `meta` diye atıyordu. Aynı slot, sayfa
   yenilenmeden önce ve sonra farklı şekilde geliyordu:
     · Tur Karşılaştırma künyesi (pist/araç/pilot/sıcaklık) çizilmiyor
     · PDF raporunun künye satırı boş kalıyor
     · "farklı pist — kıyas dikkatli" uyarısı (venDiff) kalıcı kaynaklarda
       ASLA tetiklenemiyor — bu bir veri-dürüstlüğü koruması ve sessizce
       devre dışıydı (kayıtlı Spa stinti, yüklü Monza dosyasıyla uyarısız
       karşılaştırılabiliyordu). */
import { describe, it, expect } from "vitest";
import { packTraceMeta, readTraceSess, readTraceLaps } from "./teleTraceMeta";

const SESS = { venue: "Spa", vehicle: "Toyota GR010", driver: "A. Demircan",
  trk: 31.2, amb: 18.4 };
const LAPS = [{ sec: 128.4, lap: 3, partial: false }, { sec: 129.1, lap: 4, partial: false }];

describe("iz meta'sı — yazma ve okuma AYNI şekli kullanır", () => {
  it("gidiş-dönüş: yazılan seans meta'sı birebir geri okunur", () => {
    const node = packTraceMeta({ laps: LAPS, mapSrc: "gps", capped: false, sess: SESS });
    expect(readTraceSess(node)).toEqual(SESS);
    expect(readTraceLaps(node)).toEqual(LAPS);
  });

  it("Firebase kuralının şart koştuğu `at` alanı SAYI olarak yazılır", () => {
    /* firebase-rules.json teleTrace/$rid/$slot/meta .validate:
       newData.hasChild('at') && newData.child('at').isNumber() */
    const node = packTraceMeta({ laps: LAPS, at: 1700000000000 });
    expect(typeof node.at).toBe("number");
    expect(node.n).toBe(2);
  });

  it("seans meta'sı yoksa `sess` HİÇ yazılmaz (boş künye uydurma sayılır)", () => {
    expect(packTraceMeta({ laps: LAPS, sess: null })).not.toHaveProperty("sess");
    expect(packTraceMeta({ laps: LAPS, sess: {} })).not.toHaveProperty("sess");
    expect(readTraceSess(packTraceMeta({ laps: LAPS }))).toBe(null);
  });

  it("v2.4.1 ÖNCESİ kayıtlar (sess yok) çökmez, künye çizilmez", () => {
    const eski = { at: 1, laps: LAPS, n: 2, mapSrc: "gps", capped: false };
    expect(readTraceSess(eski)).toBe(null);
    expect(readTraceLaps(eski)).toEqual(LAPS);
  });

  it("laps eksikse tur sayısı kadar boş satır (şekil tutarlı kalır)", () => {
    expect(readTraceLaps({ at: 1 }, 3)).toEqual([{}, {}, {}]);
    expect(readTraceLaps(null, 0)).toEqual([]);
    expect(readTraceLaps(undefined, -5)).toEqual([]);
  });

  it("bozuk düğümde çökmez", () => {
    expect(readTraceSess(null)).toBe(null);
    expect(readTraceSess({ sess: "metin" })).toBe(null);
    expect(readTraceSess({ sess: [] })).toBe(null);
  });
});
