/* TrackMap render testleri — kart + "⛶ Büyüt" düğmesi (v1.4.54).
   components.render.test.jsx / stintTab.render.test.jsx ile aynı desen:
   renderToStaticMarkup, DOM gerekmez. Tıklama davranışı statik render'da
   doğrulanamaz (kullanıcı testi); burada kartın kurulumu ve düğmenin varlığı
   ile bozuk/eksik alanlarda çökmediği güvenceye alınır. */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TrackMap from "./tabs/TrackMap.jsx";

const t = (s) => s;
const LEN = 5000;
/* pist boyunca dağılmış n araç (dış halka + iç şekil için posX/posZ) */
const mkField = (n) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * 2 * Math.PI;
  return {
    pos: i + 1, driver: `D${i}`, carClass: i % 2 ? "Hypercar" : "LMGT3",
    lapDist: (i / n) * LEN, posX: Math.sin(a) * 400, posZ: Math.cos(a) * 300,
    location: "TRACK", isPlayer: i === 3,
  };
});

describe("TrackMap", () => {
  it("kart + büyüt düğmesi render olur, pencere varsayılan olarak KAPALI", () => {
    const html = renderToStaticMarkup(
      <TrackMap t={t} field={mkField(12)} trackLength={LEN} />);
    expect(html).toContain("Pist Haritası");
    expect(html).toContain("Büyüt");
    expect(html).toContain("<svg");
    expect(html).not.toContain("wxmodal");   // pencere yalnız tıklayınca açılır
  });

  it("posX/posZ olmayan araçlar elenir, çökme yok", () => {
    const field = [...mkField(4), { pos: 5, driver: "X", carClass: "LMGT3", lapDist: 100 }];
    const html = renderToStaticMarkup(
      <TrackMap t={t} field={field} trackLength={LEN} />);
    expect(html).toContain("Pist Haritası");
  });

  it("boş / bozuk saha ve trackLength 0 ile çökmez", () => {
    for (const [f, len] of [[[], LEN], [null, LEN], [mkField(3), 0]]) {
      expect(() => renderToStaticMarkup(
        <TrackMap t={t} field={f} trackLength={len} />)).not.toThrow();
    }
  });

  it("oyuncu aracı beyaz/#960018 halkalı çizilir", () => {
    const html = renderToStaticMarkup(
      <TrackMap t={t} field={mkField(6)} trackLength={LEN} />);
    expect(html).toContain("#960018");
  });

  it("paylaşımlı prop'larla (tid/trackKey/canSave) çökmeden render olur", () => {
    expect(() => renderToStaticMarkup(
      <TrackMap t={t} field={mkField(8)} trackLength={LEN}
        tid="team1" trackKey="Spa" canSave />)).not.toThrow();
  });

  it("noktalar CSS transform + transition ile konumlanır (akıcı hareket)", () => {
    // Regresyon (v1.4.56): daireler cx/cy ile konumlanıp her karede zıplıyordu;
    // artık <g style=transform/transition> sarmalar → tarayıcı kareler arasını animate eder.
    const html = renderToStaticMarkup(
      <TrackMap t={t} field={mkField(6)} trackLength={LEN} />);
    expect(html).toContain("transition:transform .5s linear");
    expect(html).toMatch(/transform:translate\([-\d.]+px, ?[-\d.]+px\)/);
  });

  /* v1.4.95 — pist durumu katmanı (session prop). session yoksa hiçbir katman yok. */
  it("session yoksa durum rozeti/katmanı çizilmez (geriye uyum)", () => {
    const html = renderToStaticMarkup(
      <TrackMap t={t} field={mkField(6)} trackLength={LEN} />);
    expect(html).not.toContain("mapcond");
  });

  it("FCY bayrağında yol amber renklenir + durum rozeti FCY yazar", () => {
    const html = renderToStaticMarkup(
      <TrackMap t={t} field={mkField(6)} trackLength={LEN}
        session={{ flag: "FCY", trackTemp: 31, ambientTemp: 24 }} />);
    expect(html).toContain("mapcond");
    expect(html).toContain("FCY");
    expect(html).toContain("#5a4a1e");       // ROAD_FCY
    expect(html).toContain("31°");            // sıcaklık köşesi
  });

  it("ıslak zeminde yol mavi tint + WetIcon rozeti", () => {
    const html = renderToStaticMarkup(
      <TrackMap t={t} field={mkField(6)} trackLength={LEN}
        session={{ flag: "Green", wetness: 80, rain: 50 }} />);
    expect(html).toContain("#2b4a66");       // ROAD_WET
    expect(html).toContain("mapcond-wx");
    expect(html).toContain("Wet");            // WEATHER label
  });

  it("bozuk/eksik session ile çökmez", () => {
    for (const s of [{}, { flag: "Green" }, { yellowSectors: [2] }, { wetness: null }]) {
      expect(() => renderToStaticMarkup(
        <TrackMap t={t} field={mkField(4)} trackLength={LEN} session={s} />)).not.toThrow();
    }
  });

  /* v1.4.96 — hareket yönü oku (geometriden, her zaman) + pit'li araçlarla çökmez.
     Pit giriş/çıkış İŞARETLERİ gözlem (çok kare) ister → birim testte (trackSectors)
     kapsanır; statik render'da prevLoc boş olduğu için işaret çizilmez (dürüst). */
  it("hareket yönü oku (polygon) çizilir", () => {
    const html = renderToStaticMarkup(
      <TrackMap t={t} field={mkField(8)} trackLength={LEN} />);
    expect(html).toContain("<polygon");
  });

  it("PIT konumlu araçlarla çökmeden render olur", () => {
    const field = mkField(6).map((c, i) => (i === 2 ? { ...c, location: "PIT" } : c));
    expect(() => renderToStaticMarkup(
      <TrackMap t={t} field={field} trackLength={LEN} tid="team1" trackKey="Spa" canSave />))
      .not.toThrow();
  });
});
