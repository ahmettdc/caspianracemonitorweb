import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { tempColor, TrackTempIcon } from "./TrackTempIcon";

describe("tempColor — pist sıcaklığına göre renk", () => {
  it("soğuk<25 mavi · ılık<40 amber · sıcak≥40 kırmızı", () => {
    expect(tempColor(15)).toBe("#4C9AFF");
    expect(tempColor(24)).toBe("#4C9AFF");
    expect(tempColor(25)).toBe("#EAB24A");
    expect(tempColor(39)).toBe("#EAB24A");
    expect(tempColor(40)).toBe("#E0556A");
    expect(tempColor(52)).toBe("#E0556A");
  });
  it("geçersiz → nötr", () => {
    expect(tempColor(null)).toBe("#8a8a92");
    expect(tempColor("")).toBe("#8a8a92");
    expect(tempColor("x")).toBe("#8a8a92");
  });
});

describe("TrackTempIcon — render", () => {
  it("çökmeden basar; farklı sıcaklık farklı çıktı (renk + seviye)", () => {
    const at = (v) => renderToStaticMarkup(<TrackTempIcon temp={v} size={16} title="Pist" />);
    expect(at(38.8)).toContain("<svg");
    expect(at(18)).toContain("#4C9AFF");     // soğuk → mavi
    expect(at(48)).toContain("#E0556A");     // sıcak → kırmızı
    expect(at(18)).not.toBe(at(48));         // renk + cıva seviyesi farklı
    expect(at(38.8)).not.toContain("🛣");    // emoji değil, vektör
  });
});
