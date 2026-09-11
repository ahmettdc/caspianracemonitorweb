/* UpdateModal render testleri (v2.4.2) — saha şikayeti: "güncelleme geldiğinde mouse
   scroll ile aşağı yukarı hareket ettiremiyorum, güncellemeyi kuramıyorum".

   Kök neden: kartta maxHeight YOKTU ama overflow:"hidden" vardı ve modal açıkken
   body scroll'u da kilitleniyor. "Öne çıkanlar" satırları changelog'un ilk üç
   maddesi — v2.4.1'de tam paragraf — olduğu için kart pencereyi aşıyor, taşan kısım
   kırpılıyor ve ALT BARDAKİ güncelle/yeniden başlat düğmesine hiçbir şekilde
   ulaşılamıyordu.

   Testler yapıyı doğrular: kart pencereyle sınırlı, gövde kayar, alt bar kaymaz.
   jsdom yok → renderToStaticMarkup; efektler statik render'da çalışmaz. */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import UpdateModal from "./UpdateModal.jsx";

/* Gerçek dert: kısa metin değil, changelog'un paragraf boyu maddeleri. */
const LONG = [
  "🗺️ SEKTÖR AYIRICILARI TAKIMA HİÇ ULAŞMIYORDU. ".repeat(12),
  "🌍 İNGİLİZCE ARAYÜZDE 107 METİN TÜRKÇE KALIYORDU. ".repeat(12),
  "🎨 AÇIK TEMA YARIM KALMIŞTI. ".repeat(12),
];

const render = (extra = {}) => renderToStaticMarkup(
  <UpdateModal open lang="tr" oldVersion="v2.4.1" newVersion="v2.4.2" size="18 MB"
    highlights={LONG} {...extra} />);

/* html içinde `needle`'ı taşıyan <div>'in [başlangıç, bitiş] aralığını verir —
   iç içe div'leri sayarak. Amaç: bir düğmenin O div'in İÇİNDE olup olmadığını
   string üzerinden ispatlayabilmek (jsdom'a bağımlı kalmadan). */
function divRange(html, needle) {
  const hit = html.indexOf(needle);
  expect(hit).toBeGreaterThan(-1);
  const start = html.lastIndexOf("<div", hit);
  let i = start, depth = 0;
  while (i < html.length) {
    const open = html.indexOf("<div", i + 1);
    const close = html.indexOf("</div>", i + 1);
    if (close === -1) break;
    if (open !== -1 && open < close) { depth++; i = open; continue; }
    if (depth === 0) return [start, close + 6];
    depth--; i = close;
  }
  throw new Error("kapanmayan div");
}

describe("UpdateModal render (v2.4.2 — kaydırılamayan güncelleme penceresi)", () => {
  const html = render();

  it("#1 kart pencereden uzun olamaz (maxHeight) — taşan içerik kırpılmaz", () => {
    expect(html).toContain("max-height:calc(100vh - 48px)");
  });

  it("#2 uzun sürüm notu için kayan bir gövde var (fare tekerleği çalışır)", () => {
    expect(html).toContain("overflow-y:auto");
    expect(html).toContain("overscroll-behavior:contain");
  });

  it("#3 'Şimdi güncelle' düğmesi kayan gövdenin DIŞINDA — her zaman görünür", () => {
    const [s, e] = divRange(html, "overflow-y:auto");
    const btn = html.indexOf("Şimdi güncelle");
    expect(btn).toBeGreaterThan(-1);
    expect(btn > s && btn < e).toBe(false);   // gövdenin içinde OLMAMALI
    expect(btn).toBeGreaterThan(e);           // alt barda, gövdeden sonra
  });

  it("#4 'Yeniden başlat' (ready) düğmesi de kayan gövdenin dışında", () => {
    const h = render({ phase: "ready" });
    const [, e] = divRange(h, "overflow-y:auto");
    expect(h.indexOf("Yeniden başlat")).toBeGreaterThan(e);
  });

  it("#5 indirme yüzdesi kaymaz — ilerleme çubuğu da gövdenin dışında", () => {
    const h = render({ phase: "downloading", pct: 42 });
    const [, e] = divRange(h, "overflow-y:auto");
    expect(h).toContain("42%");
    expect(h.indexOf("42%")).toBeGreaterThan(e);
  });

  it("#6 öne çıkan yokken de çizilir (boş gövde kartı bozmaz)", () => {
    const h = render({ highlights: [] });
    expect(h).toContain("Şimdi güncelle");
    expect(h).toContain("max-height:calc(100vh - 48px)");
  });
});
