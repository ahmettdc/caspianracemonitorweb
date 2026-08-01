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

  it("#3 'Tutuş' (rubber) KPI'sı 🛞 %NN olarak görünür", () => {
    expect(html).toContain("Tutuş");
    expect(html).toMatch(/🛞\s*%\d+/);
  });

  it("boş saha ile çökmez", () => {
    expect(render({ ...demoLive(30), field: [] })).toContain("Tutuş");
  });
});
