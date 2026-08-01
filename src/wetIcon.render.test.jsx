/* WetIcon (zemin ıslaklığı ikon sistemi) render testleri — renderToStaticMarkup. */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WetIcon } from "./WetIcon.jsx";

describe("WetIcon", () => {
  it("her WEATHER kademesi için 24x24 svg üretir", () => {
    for (const id of ["dry", "damp", "slwet", "wet", "xwet"]) {
      const h = renderToStaticMarkup(<WetIcon id={id} />);
      expect(h).toContain("<svg");
      expect(h).toContain('viewBox="0 0 24 24"');
    }
  });
  it("bilinmeyen id → hiçbir şey render etmez", () => {
    expect(renderToStaticMarkup(<WetIcon id="nope" />)).toBe("");
    expect(renderToStaticMarkup(<WetIcon id={undefined} />)).toBe("");
  });
  it("aynı ağaçtaki iki damp ikonunun clipPath id'si BENZERSİZ (çakışma yok)", () => {
    const both = renderToStaticMarkup(<><WetIcon id="damp" /><WetIcon id="damp" /></>);
    const ids = [...both.matchAll(/id="(wc[^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBe(2);
    expect(ids[0]).not.toBe(ids[1]);
  });
  it("title verilince erişilebilir etiket (aria-label + <title>)", () => {
    const h = renderToStaticMarkup(<WetIcon id="wet" title="Wet" />);
    expect(h).toContain("<title>Wet</title>");
    expect(h).toContain('aria-label="Wet"');
  });
});
