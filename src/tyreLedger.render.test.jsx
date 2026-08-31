/* Lastik defteri (v2.3.0) render sözleşmesi. TyreTab canlı aboneliği tid/rid/lapKey
   olmadan kurmaz → statik render'da defter BOŞ durumu gösterir; dolu durum saf
   modülde (tyreLedger.test.js, 13 test) doğrulanır. Buradaki asıl kilit: veri
   yokken UYDURMA satır çizilmemesi ve sınırların ekranda YAZMASI. */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

globalThis.window ??= globalThis;
globalThis.document ??= { addEventListener() {}, removeEventListener() {}, createElement: () => ({}) };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };

const { default: TyreTab } = await import("./tabs/TyreTab.jsx");

const t = (s) => s;
const base = {
  t,
  st: { tyreLimit: 4, tyres: {}, tyreQual: ["1", "2", "3", "4"],
    tyreStints: [["", "", "", ""], ["5", "6", "", ""]],
    tyreWearPerStint: 30, tyreChangeT12: 4.5, tyreChangeT34: 12 },
  up: () => {},
  /* tyreInfo.rows gerçek şekli: { label, row, vals }; row === -1 → Qual satırı. */
  tyreInfo: {
    rows: [
      { label: "Qual", row: -1, vals: ["1", "2", "3", "4"] },
      { label: "S1", row: 0, vals: ["", "", "", ""] },      // taşıma → 2. stint
      { label: "S2", row: 1, vals: ["5", "6", "", ""] },    // 2 lastik → +4.5s
    ],
    cellCls: () => "", used: 0, counts: {}, allowedIn: () => true,
    conflicts: [], available: 4,
  },
  racePlan: { fullStints: 3, rows: [] },
  carriedAt: () => false,
  upTyreCell: () => {}, quickTyre: () => {},
  qsel: "", setQsel: () => {}, QSEL_LBL: {}, clearTyres: () => {},
};
const render = (extra = {}) => renderToStaticMarkup(<TyreTab {...base} {...extra} />);

describe("Lastik defteri — render", () => {
  it("bölüm çizilir", () => {
    expect(render()).toContain("Lastik defteri");
  });

  it("veri yokken UYDURMA satır yok, boş durum açıklanır", () => {
    const out = render();
    expect(out).toContain("Henüz kayıt yok");
    expect(out).not.toContain("YENİ");
    expect(out).not.toContain("Başlangıç");
  });

  /* Kullanıcı kararının dayandığı iki sınır ekranda YAZMALI (CLAUDE.md §1):
     set kimliği oyundan gelmiyor, hamur köşe başına okunamıyor. */
  it("veri yolunun sınırları ekranda yazıyor", () => {
    const out = render();
    expect(out).toContain("SET KİMLİĞİ vermiyor");
    expect(out).toContain("köşe başına değil");
  });

  it("mevcut plan tablosu bozulmadan duruyor (yan yana geçiş)", () => {
    const out = render();
    expect(out).toContain("Set envanteri");
    expect(out).toContain("Lastik limiti");
  });

  /* Plan↔Gerçek yalnız İKİSİ de varken çizilir. Defter boşken "plana uyuyor"
     demek, hiçbir şey gerçekleşmemişken uyum İDDİA etmek olurdu. */
  it("defter boşken Plan↔Gerçek çizilmez (boş uyum iddiası yok)", () => {
    const out = render({ st: { ...base.st, tyreStints: [["1", "2", "3", "4"]] } });
    expect(out).not.toContain("Plan ↔ Gerçek");
    expect(out).not.toContain("plana uyuyor");
  });

  /* DİŞ MODELİ (TinyPedal tyre_strategy_planner deseni) — kullanıcının ilk
     sorduğu şey: hangi stint YENİ lastik kullanıyor. Hücrede birebir yazmalı. */
  it("plan hücresinde diş yazıyor: 'Yeni–%70' ve aşınmış '%70–%40'", () => {
    const out = render();
    expect(out).toContain("Yeni–%70");   // ilk kullanım
    expect(out).toContain("%70–%40");    // taşınan set, ikinci stint
  });

  it("değişim süresi sütunu: 2 lastik ucuz, 4 lastik pahalı", () => {
    const out = render();
    expect(out).toContain("Değişim");
    expect(out).toContain("+4.5s");      // S2'de 2 lastik
  });

  it("aşınma %0 iken diş metni ÇİZİLMEZ (sahte kesinlik yok)", () => {
    const out = render({ st: { ...base.st, tyreWearPerStint: 0 } });
    expect(out).not.toContain("Yeni–");
  });

  it("eksik canlı proplarıyla çökmez", () => {
    expect(() => render({ tid: "", rid: "", lapKey: "" })).not.toThrow();
    expect(() => render({ tid: "T", rid: "R", lapKey: "c7" })).not.toThrow();
  });
});
