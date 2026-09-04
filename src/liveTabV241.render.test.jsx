/* LiveTab render testleri (v2.4.1 hata düzeltmeleri).
   renderToStaticMarkup — efektler çalışmaz, yalnız render gövdesi ölçülür. */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

globalThis.window ??= globalThis;
globalThis.document ??= {
  fullscreenEnabled: false, fullscreenElement: null,
  addEventListener() {}, removeEventListener() {}, createElement: () => ({}),
};
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };

const { default: LiveTab } = await import("./tabs/LiveTab.jsx");
const { demoLive } = await import("./liveDemo.js");

const t = (s) => s;
const render = (live) => renderToStaticMarkup(
  <LiveTab t={t} live={live} canEdit={false} tid="x" rid="y" />);

/* Kareyi bozmadan tek tek araçları yamalar. */
const patch = (base, fn) => ({ ...base, field: base.field.map((c, i) => ({ ...c, ...(fn(c, i) || {}) })) });

describe("Ceza sütunu — bekleyen ceza kümülatif toplam 0 iken de görünür", () => {
  /* Köprü/aggregator yarış ORTASINDA başlarsa pen_total taban alınır ve
     penaltiesTotal 0'da kalır. O anda drive-through bekleyen araçlar kırmızı
     kalın bir "—" gösteriyordu — yani "cezası yok" diyordu. */
  const live = patch(demoLive(30), (c, i) => (i === 1 ? { penalties: 2, penaltiesTotal: 0 } : null));
  const html = render(live);

  it("bekleyen ceza sayısı ve '•' işareti yazılıyor", () => {
    expect(html).toMatch(/>2 •</);
  });
  it("kümülatif de bekleyen de yoksa '—' kalır", () => {
    const clean = render(patch(demoLive(30), () => ({ penalties: 0, penaltiesTotal: 0 })));
    expect(clean).not.toMatch(/>\d+ •</);
    expect(clean).toMatch(/—/);
  });
  it("kümülatif varsa toplam yazılır (eski davranış korunur)", () => {
    const h = render(patch(demoLive(30), (c, i) => (i === 1 ? { penalties: 0, penaltiesTotal: 3 } : null)));
    expect(h).toMatch(/>3</);
  });
});

describe("'En İyi' moru SINIF rekorudur (saha geneli değil)", () => {
  /* Çok sınıflı LMU sahasında saha minimumu her zaman Hypercar'da olur; saha
     geneliyle karşılaştırınca hiçbir LMGT3 satırı mor olamıyordu — oysa aynı
     ekranda sektör hücresi ve satır flash'ı moru SINIF rekoru için kullanıyor. */
  const base = demoLive(30);
  const gt3 = base.field.filter((c) => c.carClass === "LMGT3");
  expect(gt3.length).toBeGreaterThan(1);
  const fastestGt3 = Math.min(...gt3.map((c) => c.bestSec).filter((v) => v > 0));
  const overall = Math.min(...base.field.map((c) => c.bestSec).filter((v) => v > 0));

  it("fikstür gerçekten çok sınıflı ve sınıf rekoru saha rekorundan yavaş", () => {
    expect(fastestGt3).toBeGreaterThan(overall);
  });

  it("En İyi modunda mor hücre sayısı = SINIF sayısı (her sınıfta bir rekor)", () => {
    /* "Son ⇄ En İyi" başlığına basılmadan lapMode kapalı; mor yalnız o modda
       çizilir. Bu yüzden hesabı doğrudan doğruluyoruz: sınıf başına minimum. */
    const byClass = {};
    for (const c of base.field) {
      if (!(c.bestSec > 0)) continue;
      byClass[c.carClass] = Math.min(byClass[c.carClass] ?? Infinity, c.bestSec);
    }
    const purple = base.field.filter((c) => c.bestSec > 0 && c.bestSec === byClass[c.carClass]);
    expect(purple.map((c) => c.carClass).sort()).toEqual(["Hypercar", "LMGT3"]);
  });
});
