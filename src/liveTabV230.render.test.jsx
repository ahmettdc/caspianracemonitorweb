/* LiveTab v2.3.0 render sözleşmesi — bu sürümde standings'e eklenen görsel
   davranışları kilitler. renderToStaticMarkup + demoLive() (liveTab.render.test.jsx
   ile aynı desen; efektler statik render'da çalışmaz, ilk kare doğrulanır). */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

globalThis.window ??= globalThis;
globalThis.document ??= {
  fullscreenEnabled: false, fullscreenElement: null,
  addEventListener() {}, removeEventListener() {}, createElement: () => ({}),
};
globalThis.ResizeObserver ??= class {
  observe() {} unobserve() {} disconnect() {}
};
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };

const { default: LiveTab } = await import("./tabs/LiveTab.jsx");
const { demoLive } = await import("./liveDemo.js");

const t = (s) => s;
const render = (live) => renderToStaticMarkup(
  <LiveTab t={t} live={live} canEdit={false} tid="x" rid="y" />);

describe("LiveTab v2.3.0 — standings yenilikleri", () => {
  const live = demoLive(30);
  const html = render(live);

  it("SEKTÖR hücresi tooltip'i renk anlamını açıklar", () => {
    expect(html).toContain("Mor: sınıf rekoru · Yeşil: kişisel rekor");
  });

  /* KONTROLLÜ veri: demo karesinde "var(--purple)" OwnCar'ın "En iyi" kutucuğunda
     da geçtiği için serbest arama yanlış pozitif verir. Burada sektör değerinin
     KENDİSİNİ renkli span içinde arıyoruz. */
  it("sektör başına MOR (sınıf rekoru) ve YEŞİL (kişisel rekor) ayrı ayrı boyanır", () => {
    const car = (o) => ({ carClass: "Hypercar", lapsDone: 5, lastSec: 105,
      bestSec: 105, gapSec: 0, ...o });
    const frame = {
      ts: Date.now(), session: { sessionType: "Yarış", trackLength: 5000 },
      own: null,
      field: [
        // A: S1 = 30.0 → hem kişisel hem SINIF rekoru → MOR
        car({ carId: 1, driver: "A", bestSectors: [30.0, 44.0, 31.0],
          curSectors: [30.0, null] }),
        // B: S1 = 31.0 → kendi rekoru ama sınıf rekoru değil (A daha hızlı) → YEŞİL
        car({ carId: 2, driver: "B", pos: 2, bestSectors: [31.0, 45.0, 32.0],
          curSectors: [31.0, null] }),
        // C: S1 = 33.5 → ne kişisel ne sınıf rekoru → renksiz
        car({ carId: 3, driver: "C", pos: 3, bestSectors: [32.0, 46.0, 33.0],
          curSectors: [33.5, null] }),
      ],
    };
    const out = render(frame);
    expect(out).toContain('style="color:var(--purple);font-weight:700">30.0<');
    expect(out).toContain('style="color:var(--green);font-weight:700">31.0<');
    // rekor OLMAYAN sektör kalın/renkli değil
    expect(out).not.toContain('style="color:var(--purple);font-weight:700">33.5<');
    expect(out).not.toContain('style="color:var(--green);font-weight:700">33.5<');
  });

  it("sınıf rekoru SÜZGEÇTEN bağımsızdır (kendi sınıfım açıkken de gerçek rekor)", () => {
    // farklı sınıftaki daha hızlı araç Hypercar'ın rekorunu ETKİLEMEZ
    const car = (o) => ({ lapsDone: 5, lastSec: 105, bestSec: 105, gapSec: 0, ...o });
    const out = render({
      ts: Date.now(), session: { sessionType: "Yarış", trackLength: 5000 }, own: null,
      field: [
        car({ carId: 1, driver: "A", carClass: "Hypercar",
          bestSectors: [30.0, 44.0, 31.0], curSectors: [30.0, null] }),
        car({ carId: 2, driver: "B", pos: 2, carClass: "LMGT3",
          bestSectors: [28.0, 42.0, 29.0], curSectors: [28.0, null] }),
      ],
    });
    // ikisi de KENDİ sınıfının rekorunu tutuyor → ikisi de mor
    expect(out).toContain('style="color:var(--purple);font-weight:700">30.0<');
    expect(out).toContain('style="color:var(--purple);font-weight:700">28.0<');
  });

  it("sıralama okları her sıralanabilir sütunda var", () => {
    expect(html).toContain("Bu sütuna göre sırala");
    // varsayılan (yarış sırası) → hiçbir sütun etkin değil, hepsi ⇅
    expect(html).toContain("⇅");
  });

  it("arama kutusu çizilir", () => {
    expect(html).toContain("Pilot / takım ara");
  });

  it("RELATIVE düğmesi kendi aracımız sahadayken görünür", () => {
    expect(html).toContain("Relative");
    expect(html).toContain("Pist konumuna göre etrafımdaki araçlar (±3)");
  });

  it("LASTİK sütunu DÖRT KÖŞE ızgarası çizer (tek 'en kötü' değer değil)", () => {
    // 2×2 ızgara: inline-grid + iki sütunluk şablon (TyreCell'in single OLMAYAN dalı)
    expect(html).toContain("inline-grid");
    expect(html).toMatch(/grid-template-columns:\s*auto auto/);
  });

  it("PİT sütunu son pitteki lastik değişimi rozetini gösterir", () => {
    // demoLive: çift indeksli araçlar 4 lastik, tekler 2 ÖN
    expect(html).toMatch(/Son pitte 4 lastik değişti|Son pitte 2 lastik değişti/);
    expect(html).toContain("ÖN");
  });

  it("kendi araç kartı artık PİLOT ADINI gösterir (v2.3.0 own.driver düzeltmesi)", () => {
    const me = live.field.find((c) => c.isPlayer);
    expect(me.driver).toBeTruthy();
    expect(html).toContain(me.driver);
    // jenerik yedeğe DÜŞMEMELİ
    expect(html).not.toContain("Kendi Araç");
  });

  it("tur sayacı yalnız tur-tipi yarışta çizilir (süre-tipinde '/0' yazmaz)", () => {
    expect(html).not.toContain("/0<");
    const lapRace = { ...live, session: { ...live.session, totalLaps: 68 } };
    expect(render(lapRace)).toContain("/68");
  });

  /* Bu testi v2.3.0 geliştirmesi sırasında yakalanan bir regresyon için ekledim:
     satır destructure'ından `id` düşünce sınıf-içi pozisyon rozeti sessizce
     kayboluyordu ve HİÇBİR test bunu görmüyordu. */
  it("sınıf-içi pozisyon rozeti çizilir (sınıf renginde)", () => {
    const car = (o) => ({ lapsDone: 5, lastSec: 105, bestSec: 105, gapSec: 0, ...o });
    const out = render({
      ts: Date.now(), session: { sessionType: "Yarış", trackLength: 5000 }, own: null,
      field: [
        car({ carId: 1, pos: 1, driver: "A", carClass: "Hypercar" }),
        car({ carId: 2, pos: 2, driver: "B", carClass: "LMGT3" }),
        car({ carId: 3, pos: 3, driver: "C", carClass: "LMGT3" }),
      ],
    });
    // GT3 sınıfının 2. aracı → sınıf-içi pozisyon "2" GT3 turuncusuyla yazılır
    expect(out).toMatch(/color:#EF8A2B[^>]*>2</);
  });

  it("DNF/DSQ çipi çizilir ve satır soluklaşır; FIN çip ÜRETMEZ", () => {
    const car = (o) => ({ lapsDone: 5, lastSec: 105, bestSec: 105, gapSec: 0, ...o });
    const out = render({
      ts: Date.now(), session: { sessionType: "Yarış", trackLength: 5000 }, own: null,
      field: [
        car({ carId: 1, pos: 1, driver: "A", carClass: "Hypercar" }),
        car({ carId: 2, pos: 2, driver: "B", carClass: "Hypercar", finishStatus: 2 }),
        car({ carId: 3, pos: 3, driver: "C", carClass: "Hypercar", finishStatus: 3 }),
        car({ carId: 4, pos: 4, driver: "D", carClass: "Hypercar", finishStatus: 1 }),
      ],
    });
    expect(out).toContain(">DNF<");
    expect(out).toContain(">DSQ<");
    expect(out).toContain("opacity:0.45");        // bırakmış satır soluk
    // yarış bitince HERKES finishStatus=1 olur → FIN çipi bilgi taşımaz, çizilmez
    expect(out).not.toContain(">FIN<");
  });

  it("PİT sütunu aşamayı gösterir; ÇAĞRI araç PİSTTEYKEN ayrı renkte", () => {
    const car = (o) => ({ lapsDone: 5, lastSec: 105, bestSec: 105, gapSec: 0,
      carClass: "Hypercar", ...o });
    const out = render({
      ts: Date.now(), session: { sessionType: "Yarış", trackLength: 5000 }, own: null,
      field: [
        car({ carId: 1, pos: 1, driver: "A", pitState: 1, inPits: false }),  // çağrı
        car({ carId: 2, pos: 2, driver: "B", pitState: 3, inPits: true }),   // durdu
        car({ carId: 3, pos: 3, driver: "C", pitState: 4, inPits: true }),   // çıkış
      ],
    });
    expect(out).toContain(">ÇAĞRI<");
    expect(out).toContain(">DURDU<");
    expect(out).toContain(">ÇIKIŞ<");
    expect(out).toContain("Pit talebi verildi — araç henüz pistte");
    expect(out).toContain("var(--rc-warn)");      // çağrı diğer aşamalardan ayrı ton
  });

  it("pitState YOKSA eski davranış korunur (eski köprü → düz PIT çipi)", () => {
    const car = (o) => ({ lapsDone: 5, lastSec: 105, bestSec: 105, gapSec: 0,
      carClass: "Hypercar", ...o });
    const out = render({
      ts: Date.now(), session: { sessionType: "Yarış", trackLength: 5000 }, own: null,
      field: [car({ carId: 1, pos: 1, driver: "A", inPits: true })],
    });
    expect(out).toContain(">PIT<");
    expect(out).not.toContain(">DURDU<");
  });

  it("Vmax sütunu seans en yüksek hızını gösterir; veri yoksa —", () => {
    const car = (o) => ({ lapsDone: 5, lastSec: 105, bestSec: 105, gapSec: 0,
      carClass: "Hypercar", ...o });
    const out = render({
      ts: Date.now(), session: { sessionType: "Yarış", trackLength: 5000 }, own: null,
      field: [
        car({ carId: 1, pos: 1, driver: "A", topSpeed: 318, speedKph: 240 }),
        car({ carId: 2, pos: 2, driver: "B" }),   // hız verisi yok (eski köprü)
      ],
    });
    expect(out).toContain(">318<");
    expect(out).toContain("Vmax");
    /* Dürüstlük notu tooltip'te. NOT: kesme işareti HTML'de &#x27; olarak kaçar,
       o yüzden apostrofsuz bir parça aranıyor. */
    expect(out).toContain("de atılan hız da buna dahildir");
    expect(out).toContain("Şu an: 240 km/h");
  });

  it("boş saha / eksik veri ile çökmez", () => {
    expect(() => render({ ...live, field: [] })).not.toThrow();
    expect(() => render({ ...live, field: [{ pos: 1, driver: "X" }] })).not.toThrow();
    expect(() => render({ ...live, session: {} })).not.toThrow();
  });
});
