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
});

describe("LiveTab v2.0 — saha tablosu", () => {
  const html = render(demoLive(30));

  it("v2 sütun sırası: Poz·Sınıf → Pilot → Tur → Gap → Son tur → Sektör → AVG5 → "
    + "Enerji → VE/tur → Lastik → Stint → Hasar → Incident → Pit", () => {
    const heads = [...html.matchAll(/<th[^>]*>(?:<button[^>]*>)?([^<]+)/g)].map((m) => m[1].trim());
    const want = ["Poz · Sınıf", "Pilot", "Tur", "Gap", "Son tur", "Sektör", "AVG5",
      "Enerji", "VE/tur", "Lastik", "Stint", "Hasar", "Incident", "Pit"];
    const got = heads.filter((h) => want.some((w) => h.startsWith(w)));
    expect(got.map((h) => h.replace(" ⇄", "").trim())).toEqual(want);
  });

  it("süzgeç TEK noktada — Poz · Sınıf başlığı; sınıf çip şeridi YOK", () => {
    expect(html).toContain("Poz · Sınıf");
    /* v1.8.19 öncesi çip şeridi kaldırıldı: tablo üstünde sınıf çipi olmamalı */
    expect(html).not.toMatch(/class="chip"[^>]*>\s*(Hypercar|LMP2|GT3)\s*</i);
  });

  it("başlık geçişleri ⇄ işaretiyle işaretli (Gap/Son tur/AVG5/Pilot)", () => {
    expect((html.match(/⇄/g) || []).length).toBeGreaterThanOrEqual(4);
  });

  it("varsayılan yoğunluk Pit duvarı; anahtar YALNIZ bu ekranda", () => {
    expect(html).toContain("fieldtbl wall");
    expect(html).toContain("◱ Pit duvarı");
  });

  it("sektör sütunu varsayılan açık ve gizlenebilir düğmesi var", () => {
    expect(html).toContain("Sektör");
    expect(html).toContain("secbtn");
  });

  it("sınıf-içi pozisyon çerçevesiz rakam olarak (fclspos), rozet değil", () => {
    expect(html).toContain("fclspos");
  });

  it("kendi araç satırı .me (tıklanamaz), rakipler .pick", () => {
    expect(html).toContain('class="me"');
    expect(html).toContain('class="pick"');
  });

  it("satır sol kenarı 4px sınıf rengini alır", () => {
    expect(html).toMatch(/border-left-color:#[0-9A-Fa-f]{6}/);
  });
});
