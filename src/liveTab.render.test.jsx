/* LiveTab render testleri (v1.4.74) — renderToStaticMarkup, jsdom yok → minimal
   tarayıcı-global stub'ları (yalnız render gövdesi `document.fullscreenEnabled`'e
   dokunur; efektler statik render'da çalışmaz). demoLive() ile gerçekçi kare besleyip:
   (#1) gaz/fren çubuğunun akıcı geçişi (width .4s linear),
   (#3) 'Tutuş' KPI'sının (🛞 %NN) session şeridinde göründüğü doğrulanır. */
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
globalThis.localStorage ??= {
  getItem: () => null, setItem() {}, removeItem() {},
};

const { default: LiveTab } = await import("./tabs/LiveTab.jsx");
const { demoLive } = await import("./liveDemo.js");

const t = (s) => s;
const render = (live) => renderToStaticMarkup(
  <LiveTab t={t} live={live} canEdit={false} tid="x" rid="y" />);

describe("LiveTab render (v1.4.74)", () => {
  const html = render(demoLive(30));

  it("#1 gaz/fren pedal çubukları akıcı geçişle (width .4s linear) çizilir", () => {
    expect(html).toContain("width .4s linear");   // .15s DEĞİL (donuk ilerleme düzeltmesi)
    expect(html).not.toContain("width .15s linear");
  });

  it("#3 'Tutuş' (rubber) KPI'sı GripIcon + %NN olarak görünür (v1.8.10: emoji değil SVG)", () => {
    expect(html).toContain("Tutuş");
    expect(html).toMatch(/%\d+/);
    expect(html).toMatch(/clip-path="url\(#gc/);      // GripIcon seviye-dolgu SVG'si (🛞 değil)
  });

  it("boş saha ile çökmez", () => {
    expect(render({ ...demoLive(30), field: [] })).toContain("Tutuş");
  });

  /* Üst ıslaklık bildirim çubuğu (v2.5.x): wxSug varken + canEdit → animasyonlu
     çubuk "Zemin değişti → <kademe>" + Uygula. Yetki yoksa/öneri yoksa çıkmaz. */
  const wxSug = { id: "damp", label: "Damp", rain: 0, wetness: 8 };
  const renderW = (props) => renderToStaticMarkup(
    <LiveTab t={t} live={demoLive(30)} tid="x" rid="y" {...props} />);

  it("#4 ıslaklık değişince üst bildirim çubuğu çıkar (canEdit + wxSug)", () => {
    const html = renderW({ canEdit: true, wxSug, onApplyWx: () => {} });
    expect(html).toContain("Zemin değişti");
    expect(html).toContain("Damp");
    expect(html).toContain("Uygula");
    expect(html).toContain("wxdrop");            // slide-down animasyonu
  });

  it("#4b yetki yoksa veya öneri yoksa çubuk çıkmaz", () => {
    expect(renderW({ canEdit: false, wxSug })).not.toContain("Zemin değişti");
    expect(renderW({ canEdit: true, wxSug: null })).not.toContain("Zemin değişti");
  });
});
