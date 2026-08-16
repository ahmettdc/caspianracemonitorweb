/* v2.0 WS0 kabuk koruma testi — tasarım token seti + kabuk CSS sınıfları
   (styles.js) ve yeni i18n EN anahtarları (i18n.js) yerinde mi?
   Amaç: sonraki turlarda token/sınıf/çeviri kontratının kazara bozulmasını
   yakalamak (render değil, sözleşme testi). */
import { describe, it, expect } from "vitest";
import { css } from "./styles.js";
import { EN } from "./i18n.js";

describe("v2.0 kabuk — design token seti (styles.js :root)", () => {
  const tokens = [
    // yüzey / çizgi
    "--panel:#120C0E", "--panel-alt:#150E10", "--rail-bg:#100A0C",
    "--line-soft:#241519", "--line-softer:#1B1013", "--line-strong:#4A2F38",
    "--line-dim:#5C3B44",
    // marka / metin / durum
    "--accent-soft:#C51E38", "--faint:#6B4A52", "--on-car:#FFE9ED", "--blue:#4C9AFF",
    // ölçü
    "--r-card:12px", "--r-modal:16px", "--r-chip:99px",
    "--sp-4:10px", "--sp-8:20px",
    "--rail-w:76px", "--panel-right:320px",
    "--z-racebar:20", "--z-modal:1000",
    "--sh-modal:0 24px 70px rgba(0,0,0,.6)",
  ];
  for (const tk of tokens) {
    it(`token tanımlı: ${tk}`, () => expect(css).toContain(tk));
  }

  it("geriye-uyum alias'ları korunur (--line2, --brand2)", () => {
    expect(css).toContain("--line2:var(--line-strong)");
    expect(css).toContain("--brand2:var(--accent-soft)");
  });

  it("light swap bloğu yeni token'ları da tanımlar", () => {
    expect(css).toContain('data-theme="light"');
    expect(css).toContain("--panel-alt:#F9F1F3");
    expect(css).toContain("--rail-bg:#F0E6E9");
  });
});

describe("v2.0 kabuk — CSS sınıfları ve keyframes", () => {
  const bits = [
    ".rc .shell{", ".rc .shell.railhidden{", ".rc .rail{", ".rc .rail-btn{",
    ".rc .rail-btn.on{", ".rc .rail-sep{", ".rc .rail-open{",
    ".rc .racebar{", ".rc .racebar .rb-cell{", ".rc .racebar .rb-pit{",
    ".rc .rb-ro-tag{", ".rc .rb-live{", ".rc .guidebox{",
    ".rc .content{", ".rc .rdpanel{", ".rc .rdpanel.on{", ".rc .rdbg{",
    ".rc .rdhead{", ".rc .rdbody{", ".rc .rdbody.ro{",
    ".rc .rdeffects{", ".rc .rdfoot{", ".rc .rdcount.on{",
    "@keyframes rcin", "@keyframes rcalert", "@keyframes rcpop",
    "@keyframes rcpb", "@keyframes rcpbc", "@keyframes rcspin",
  ];
  for (const b of bits) {
    it(`CSS içerir: ${b}`, () => expect(css).toContain(b));
  }
});

describe("v2.0 kabuk — i18n EN anahtarları", () => {
  const keys = [
    "Menü", "Dash", "Tele", "Menüyü aç", "Menüyü gizle", "Ana menü",
    "Stint planı", "Son stint yakıtı", "Canlı timing", "Lastik stratejisi",
    "Setup havuzu", "İzleyici modu", "İzleyici", "Mühendis",
    "Bayrağa Kalan", "Enerji", "veri yok", "Yarış datası", "Masaüstü uygulaması",
    // yarış datası paneli — sahnele + uygula
    "Bu değişiklik neyi etkiler", "alan değişti", "Değişiklik yok",
    "Uygula", "Geri al", "Kaydedilmemiş değişiklikler var — kapatılsın mı?",
    "📋 Stint planı süreleri ve pit pencereleri", "⛽ Son stint yakıtı hesabı",
    "🛞 Lastik limiti uyarıları",
  ];
  for (const k of keys) {
    it(`EN karşılığı var: "${k}"`, () => {
      expect(EN[k]).toBeTruthy();
      expect(typeof EN[k]).toBe("string");
    });
  }

  it("rehber metinleri EN'e çevrilmiş (örnek: dash)", () => {
    const dashGuide = "Yarışın özeti: pozisyon, enerji, lastik ve stint dağılımı. Araç ve pist görseline tıklayınca tempo referansı açılır.";
    expect(EN[dashGuide]).toContain("The race at a glance");
  });
});
