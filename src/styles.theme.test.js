/* Açık tema bütünlük testi (v2.4.1).

   KÖK-NEDEN: `:root[data-theme="light"]` bloğu yalnız ESKİ tokenları
   (--bg/--panel/--txt/--line/--accent…) rol-swap ediyordu; oysa kabuk ve tüm
   sekmeler v2.0'dan beri --rc-* tasarım tokenlarıyla çiziliyor (2551 kullanım
   vs eski tokenlarda 54). Açık temada yalnız sayfa zemini ve dört .card
   aydınlanıyor, nav rayı / üst çubuk / modallar / komut paleti / sekme
   içerikleri KOYU kalıyordu. Zemini eski token'dan, metni --rc-*'tan alan
   yerlerde kontrast okunmaz oluyordu (--rc-text #F3EAEC ↔ #FFFFFF: 1.18).

   Bu test yeni eklenen bir renk tokeninin açık tema karşılığı unutulursa düşer. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const CSS = readFileSync(new URL("./styles.js", import.meta.url), "utf8");

/* Bir CSS bloğunun gövdesini al (iç içe blok yok — kapanış ilk "\n}"). */
function bodies(selector) {
  const out = [];
  let i = 0;
  for (;;) {
    i = CSS.indexOf(selector, i);
    if (i < 0) return out;
    const a = CSS.indexOf("{", i);
    const b = CSS.indexOf("\n}", a);
    out.push(CSS.slice(a, b));
    i = b;
  }
}
function decls(texts) {
  const m = new Map();
  for (const t of texts) {
    for (const d of t.matchAll(/(--rc-[a-z0-9-]+)\s*:\s*([^;]+);/g)) m.set(d[1], d[2].trim());
  }
  return m;
}

const dark = decls(bodies(":root{"));
const light = decls(bodies(':root[data-theme="light"]{'));

const isColor = (v) => /#[0-9a-f]{3,8}\b/i.test(v) || /\brgba?\(/i.test(v);
const isAlias = (v) => v.startsWith("var(--rc-");

/* Açık temada BİLEREK aynı kalanlar — her biri gerekçeli. */
const SHARED = new Set([
  "--rc-brand",         // marka kimliği #960018 — iki temada da aynı
  "--rc-on-brand",      // marka DOLGUSU üstündeki metin; dolgu iki temada da koyu kırmızı
  "--rc-scrim",         // modal karartması — açık temada da koyu olur
  "--rc-scrim-strong",
  "--rc-danger-4",      // 4×+ set kullanımı rozeti — zaten koyu kırmızı
  "--rc-on-set",        // dolu set kutusu üstündeki koyu metin; kutu dolgusu parlak
]);

describe("açık tema (--rc-* tasarım tokenları)", () => {
  it("dark blokta --rc-* renk tokenları bulundu (test gerçekten bir şey ölçüyor)", () => {
    expect(dark.size).toBeGreaterThan(40);
    expect([...dark].filter(([, v]) => isColor(v)).length).toBeGreaterThan(30);
  });

  it("HER renk tokeninin açık tema karşılığı var", () => {
    const missing = [];
    for (const [k, v] of dark) {
      if (isAlias(v) || !isColor(v) || SHARED.has(k)) continue;
      if (!light.has(k)) missing.push(`${k}: ${v}`);
    }
    expect(missing).toEqual([]);
  });

  it("ÖLÇÜ/TİPOGRAFİ tokenları açık temada TEKRARLANMAZ (tema bağımsız)", () => {
    const SIZE_PREFIXES = ["--rc-fs-", "--rc-sp-", "--rc-r-", "--rc-ls-", "--rc-font-"];
    const wrong = [...light.keys()].filter((k) => SIZE_PREFIXES.some((p) => k.startsWith(p)));
    expect(wrong).toEqual([]);
  });

  it("açık tema metin rampası TERS (birincil metin en koyu)", () => {
    const lum = (hex) => {
      const n = hex.replace("#", "");
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
      const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const contrast = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    // birincil metin, en açık yüzeyde WCAG AA (4.5:1) üstünde okunmalı
    expect(contrast(light.get("--rc-text"), light.get("--rc-surface"))).toBeGreaterThan(4.5);
    expect(contrast(light.get("--rc-text-2"), light.get("--rc-surface"))).toBeGreaterThan(4.5);
    expect(contrast(light.get("--rc-text-3"), light.get("--rc-surface"))).toBeGreaterThan(3);
    // koyu temada da aynı sözleşme
    expect(contrast(dark.get("--rc-text"), dark.get("--rc-surface"))).toBeGreaterThan(4.5);
  });

  it("PIT OUT işareti tema duyarlı — sabit beyaz DEĞİL", () => {
    /* Açık temada .card zemini #FFFFFF; sabit "#fff" ile çizilen çizgi ve
       etiket kontrast 1.00 ile tamamen görünmez oluyordu. */
    const map = readFileSync(new URL("./tabs/TrackMap.jsx", import.meta.url), "utf8");
    expect(map).toMatch(/const PIT_OUT_COL = "var\(--rc-text\)"/);
    expect(map).not.toMatch(/pitLine\(pitFr\.exit,\s*"#fff"/);
  });
});
