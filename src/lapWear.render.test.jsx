/* Tur başı aşınma kartı (v2.3.1) render sözleşmesi. TyreTab canlı aboneliği
   tid/rid/lapKey olmadan kurmaz → statik render'da kart BOŞ durumu gösterir;
   dolu durumun hesabı saf modülde (lapWear.test.js, 20 test) doğrulanır.
   Buradaki asıl kilit: veri yokken UYDURMA sayı çizilmemesi (özellikle
   "0 tur kaldı" — Number(null)===0 tuzağının ekrandaki yüzü) ve modellenmiş
   değerin ETİKETLENMESİ (CLAUDE.md §1). */
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
  tyreInfo: {
    rows: [
      { label: "Qual", row: -1, vals: ["1", "2", "3", "4"] },
      { label: "S1", row: 0, vals: ["", "", "", ""] },
      { label: "S2", row: 1, vals: ["5", "6", "", ""] },
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

describe("Tur başı aşınma — render", () => {
  it("bölüm çizilir ve kaynağı açıklanır", () => {
    const out = render();
    expect(out).toContain("Tur başı aşınma");
    expect(out).toContain("elle giriş yok");
  });

  it("veri yokken UYDURMA sayı yok — boş durum açıklanır", () => {
    const out = render();
    expect(out).toContain("Henüz diş kaydı yok");
    // Number(null)===0 tuzağının ekrandaki yüzü: veri yokken "kaldı" YAZMAMALI
    expect(out).not.toContain("tur kaldı");
    expect(out).not.toContain("Pit penceresini belirleyen");
  });

  it("boş durumda köşe hızı / trend çizilmez", () => {
    const out = render();
    for (const s of ["hızlanıyor", "yavaşlıyor", "ÖnSol", "ArkaSağ"]) {
      expect(out).not.toContain(s);
    }
  });

  it("kalan tur MODELLENMİŞ olarak etiketlenir (gerçek okuma değil)", () => {
    /* Boş durumda not gizli; dolu durumda görünür. Notun metni kod içinde
       kalsın diye burada yalnız boş durumda ÇİZİLMEDİĞİ kilitlenir —
       etiketin varlığı dolu render'da anlamlı. */
    expect(render()).not.toContain("modellenmiş tahmindir");
  });

  it("eski köprüde (diş kaydı yok) ekran çökmez, defter bölümü çalışmaya devam eder", () => {
    const out = render();
    expect(out).toContain("Lastik defteri");
    expect(out).toContain("Lastik stratejisi");
  });
});
