/* DashTab STINT PROGRAMI → LASTİK hücresi (v2.4.4).

   Hibrit: kod bir BİLEŞİM ise (W/S/M/H) küçük bileşim logosu; SET NUMARASI ise
   (ör. "5"/"13") sayı aynen kalır. Set numarasını logoya ÇEVİRMEYİZ — set→bileşim
   eşlemesi veride yok (CLAUDE.md §1, veri uydurma). */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TyreCell } from "./tabs/DashTab.jsx";

const t = (s) => s;
const html = (code) => renderToStaticMarkup(<TyreCell code={code} t={t} />);

describe("TyreCell — bileşim mi set numarası mı", () => {
  it("W (ıslak) → bileşim logosu (wet.png), metin değil", () => {
    const h = html("W");
    expect(h).toContain("tyre-compound/wet.png");
    expect(h).toContain("<img");
  });

  it("S/M/H → ilgili bileşim logosu", () => {
    expect(html("S")).toContain("tyre-compound/soft.png");
    expect(html("M")).toContain("tyre-compound/medium.png");
    expect(html("H")).toContain("tyre-compound/hard.png");
    // tam adlar da bileşim sayılır
    expect(html("Wet")).toContain("tyre-compound/wet.png");
    expect(html("Medium")).toContain("tyre-compound/medium.png");
  });

  it("set numarası → KURU/slick lastik logosu (tyre.png); sayı metni değil", () => {
    // plan modelinde numara = kuru (tek alternatif 'W') → kuru logosu gösterilir
    expect(html("5")).toContain("tyre.png");
    expect(html("5")).not.toContain(">5<");
    expect(html("13")).toContain("tyre.png");
  });

  it("boş kod → '—'", () => {
    expect(html("")).toContain("—");
    expect(html("")).not.toContain("<img");
  });

  it("used=true → logo soluk (opacity .4)", () => {
    const h = renderToStaticMarkup(<TyreCell code="5" t={t} used />);
    expect(h).toMatch(/opacity:\s*0?\.4/);
    const dry = renderToStaticMarkup(<TyreCell code="5" t={t} />);
    expect(dry).not.toMatch(/opacity:\s*0?\.4/);
  });
});
