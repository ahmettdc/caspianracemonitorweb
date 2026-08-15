import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { gripColor, GripIcon } from "./GripIcon";

describe("gripColor — grip seviyesine göre renk", () => {
  it("düşük<40 kırmızı · orta<65 amber · yüksek≥65 yeşil", () => {
    expect(gripColor(25)).toBe("#E0556A");
    expect(gripColor(39)).toBe("#E0556A");
    expect(gripColor(40)).toBe("#EAB24A");
    expect(gripColor(64)).toBe("#EAB24A");
    expect(gripColor(65)).toBe("#37D67A");
    expect(gripColor(100)).toBe("#37D67A");
  });
  it("geçersiz → nötr", () => {
    expect(gripColor(null)).toBe("#8a6f4a");
    expect(gripColor("x")).toBe("#8a6f4a");
  });
});

describe("GripIcon — render", () => {
  it("çökmeden basar; farklı grip% farklı çıktı (renk kodlaması)", () => {
    const at = (p) => renderToStaticMarkup(<GripIcon pct={p} size={30} title="Tutuş" />);
    expect(at(55)).toContain("<svg");
    expect(at(20)).toContain("#E0556A");     // düşük → kırmızı
    expect(at(80)).toContain("#37D67A");     // yüksek → yeşil
    expect(at(20)).not.toBe(at(80));
  });
});
