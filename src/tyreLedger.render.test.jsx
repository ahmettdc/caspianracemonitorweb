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
  st: { tyreLimit: 4, tyres: {} },
  up: () => {},
  tyreInfo: { rows: [], cellCls: () => "", used: 0, counts: {}, allowedIn: () => true,
    conflicts: [], available: 4 },
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

  it("eksik canlı proplarıyla çökmez", () => {
    expect(() => render({ tid: "", rid: "", lapKey: "" })).not.toThrow();
    expect(() => render({ tid: "T", rid: "R", lapKey: "c7" })).not.toThrow();
  });
});
