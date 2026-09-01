/* Lastik ekranı (v2.3.1 tasarım fişi) render sözleşmesi.
   TyreTab canlı aboneliği tid/rid/lapKey olmadan kurmaz ve statik render efekt
   çalıştırmaz → defter BOŞ gelir; dolu hâlin hesabı saf modülde doğrulanır
   (tyreLedger.test.js). Buradaki kilit: veri yokken UYDURMA satır çizilmemesi,
   diş/değişim süresi değerlerinin fişteki gibi çıkması ve patlak işaretinin
   hücre + set kutusu + başlık rozeti üçünü birden güncellemesi (fişin kabul
   kriteri). Defter ve Plan↔Gerçek artık PENCEREDE — kapalıyken çizilmemeli. */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

globalThis.window ??= globalThis;
globalThis.document ??= { addEventListener() {}, removeEventListener() {}, createElement: () => ({}) };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };

const { default: TyreTab } = await import("./tabs/TyreTab.jsx");

const t = (s) => s;
const base = {
  t,
  /* tyreWearC + stintLaps birlikte diş adımını %20'ye sabitler → beklenen
     değerler deterministik (1. kullanım %80, 2. kullanım %60). */
  st: { tyreLimit: 8, tyreQual: ["1", "2", "3", "4"],
    tyreStints: [["", "", "", ""], ["5", "6", "", ""]],
    tyreWearPerStint: 30, tyreWearC: [2, 2, 2, 2], tyrePop: {},
    tyreChangeT12: 4.5, tyreChangeT34: 12 },
  up: () => {},
  tyreInfo: {
    rows: [
      { label: "Qual", row: -1, vals: ["1", "2", "3", "4"] },
      { label: "S1", row: 0, vals: ["", "", "", ""] },      // taşıma
      { label: "S2", row: 1, vals: ["5", "6", "", ""] },    // 2 lastik → +4.5s
    ],
    cellCls: () => "", used: 0, counts: {}, allowedIn: () => true,
    conflicts: [], available: 4,
  },
  carriedAt: (row, ci) => (row > 0 ? ["1", "2", "3", "4"][ci] : ""),
  upTyreCell: () => {}, quickTyre: () => {},
  qsel: {}, setQsel: () => {}, QSEL_LBL: {}, clearTyres: () => {},
  stintLaps: 10,
};
const render = (extra = {}) => renderToStaticMarkup(<TyreTab {...base} {...extra} />);

describe("Lastik ekranı — render (v2.3.1 fişi)", () => {
  it("üst şeridin dört bölmesi çizilir", () => {
    const out = render();
    expect(out).toContain("Kuru set limiti");
    expect(out).toContain("Set bütçesi");
    expect(out).toContain("Tur başına aşınma · köşe");
    expect(out).toContain("Plandaki lastik değişimi");
  });

  it("defter BUTONU çizilir; pencere kapalıyken içerik yok", () => {
    const out = render();
    expect(out).toContain("Lastik defteri");
    expect(out).not.toContain("Plan ↔ Gerçek");        // pencerede
    expect(out).not.toContain("Henüz kayıt yok");      // pencerede
  });

  it("veri yokken UYDURMA defter satırı yok", () => {
    const out = render();
    expect(out).not.toContain("YENİ");
    expect(out).not.toContain("Başlangıç");
    /* Defter boşken uyum İDDİA edilmez — fiş çipi koşulsuz çiziyordu,
       CLAUDE.md §1 gereği gerçek kayıt yokken gizlenir. */
    expect(out).not.toContain("plana uyuyor");
    expect(out).not.toContain("sapma");
  });

  it("plan tablosu ve köşe başlıkları duruyor", () => {
    const out = render();
    expect(out).toContain("Pitte ne oluyor · değişim");
    for (const c of ["FL", "FR", "RL", "RR"]) expect(out).toContain(c);
  });

  /* Diş barı: dolu kısım stint SONUNDA kalan diş, yanındaki sayı aynı değer. */
  it("hücre altında diş yüzdesi yazıyor (1. kullanım %80, taşınan 2. stint %60)", () => {
    const out = render();
    expect(out).toContain("%80");
    expect(out).toContain("%60");
  });

  it("aşınma 0 iken diş barı ÇİZİLMEZ (sahte kesinlik yok)", () => {
    const out = render({ st: { ...base.st, tyreWearC: [0, 0, 0, 0] } });
    expect(out).not.toContain("%80");
  });

  it("değişim süresi: 2 lastik ucuz, Qual satırında süre yok", () => {
    const out = render();
    expect(out).toContain("+4.5s");
    expect(out).toContain("pit yok · buradan başlanır");
  });

  it("plan boşken 'hiçbir pitte lastik değişmiyor' yazar (fiş kabul kriteri)", () => {
    const out = render({
      st: { ...base.st, tyreStints: [["", "", "", ""], ["", "", "", ""]] },
      tyreInfo: { ...base.tyreInfo, rows: base.tyreInfo.rows.map((r) => ({ ...r, vals: r.row < 0 ? r.vals : ["", "", "", ""] })) },
    });
    expect(out).toContain("hiçbir pitte lastik değişmiyor");
  });

  /* Fişin kabul kriteri: patlak işareti hücre + set kutusu + başlık rozetinin
     ÜÇÜNÜ birden günceller. */
  it("patlak: hücre, başlık rozeti ve diş barı birlikte güncellenir", () => {
    const out = render({ st: { ...base.st, tyrePop: { "2:0": true } } });
    expect(out).toContain("PATLAK");      // hücre rozeti
    expect(out).toContain("PATLADI");     // diş barı
    expect(out).toContain("1 patlak");    // üst şerit rozeti
  });

  it("patlak yokken rozet hiç çizilmez", () => {
    const out = render();
    expect(out).not.toContain("PATLAK");
    expect(out).not.toContain("patlak");
  });

  it("izleyici modunda yazma eylemleri görsel olarak pasif", () => {
    expect(render({ readOnly: true })).toContain("not-allowed");
  });

  it("eksik canlı proplarıyla çökmez", () => {
    expect(() => render({ tid: "", rid: "", lapKey: "" })).not.toThrow();
    expect(() => render({ tid: "T", rid: "R", lapKey: "c7" })).not.toThrow();
    expect(() => render({ st: { ...base.st, tyreWearC: undefined, tyrePop: undefined } })).not.toThrow();
  });
});
