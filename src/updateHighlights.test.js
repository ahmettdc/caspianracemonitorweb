/* updateHighlights testleri (v2.4.3) — "Öne çıkanlar" satırı maddenin BAŞLIK
   cümlesine iner. Saha şikayeti: v2.4.0'dan güncellenen kullanıcıda pencere
   1080p TAM EKRANDA bile taşıyor, güncelle düğmesine basılamıyordu. Ölçüm
   (Chromium, gerçek metin): v2.4.0'ın ilk üç maddesi 2311 karakter → kart
   452 px'te 1125 px. Başlığa inince 471, 620 px genişlikle 384. */
import { describe, it, expect } from "vitest";
import { headline, updateHighlights } from "./updateHighlights.js";
import { CHANGELOG } from "./changelog.js";

describe("headline — başlık cümlesi", () => {
  it("ilk cümleyi alır, kırpıldığını … ile söyler", () => {
    const s = "🗺️ SEKTÖR AYIRICILARI ULAŞMIYORDU. Pisti süren editörün ekranında görünüyor.";
    expect(headline(s)).toBe("🗺️ SEKTÖR AYIRICILARI ULAŞMIYORDU…");
  });

  it("tek cümlelik madde AYNEN kalır — gereksiz … eklenmez", () => {
    expect(headline("🎨 AÇIK TEMA YARIM KALMIŞTI.")).toBe("🎨 AÇIK TEMA YARIM KALMIŞTI.");
  });

  it("sürüm numarasındaki nokta cümle sonu SAYILMAZ (v2.4.1'de tuzağı)", () => {
    expect(headline("v2.4.1'de 3.5 sn olan süre düzeldi.")).toBe("v2.4.1'de 3.5 sn olan süre düzeldi.");
  });

  it("noktalama yoksa maxLen'de sözcük sınırından kırpar", () => {
    const s = "kelime ".repeat(60).trim();          // 419 karakter, hiç nokta yok
    const out = headline(s, 100);
    expect(out.length).toBeLessThanOrEqual(101);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toContain("kelim…");             // sözcük ortasından kesmez
  });

  it("çok uzun TEK cümle de maxLen'de kırpılır", () => {
    const s = `${"uzun ".repeat(80).trim()}. Devamı.`;
    expect(headline(s, 90).length).toBeLessThanOrEqual(91);
  });

  it("boş/eksik girdi çökmez", () => {
    expect(headline(null)).toBe("");
    expect(headline("   ")).toBe("");
    expect(headline(undefined)).toBe("");
  });
});

describe("updateHighlights — pencereye giden satırlar", () => {
  it("en fazla 3 satır döner ve boşları eler", () => {
    expect(updateHighlights(["Bir. iki", "", "İki.", null, "Üç.", "Dört."])).toEqual(
      ["Bir…", "İki.", "Üç."]);
  });

  it("dizi olmayan girdi çökmez", () => {
    expect(updateHighlights(undefined)).toEqual([]);
    expect(updateHighlights(null)).toEqual([]);
  });

  it("GERÇEK v2.4.0 maddeleri: 2311 karakter → 3 satır, her biri ≤ 170", () => {
    const raw = CHANGELOG.find((c) => c.v === "v2.4.0").tr.slice(0, 3);
    expect(raw.join("").length).toBeGreaterThan(2000);   // hata bu uzunlukta doğuyordu
    const out = updateHighlights(raw);
    expect(out).toHaveLength(3);
    for (const line of out) expect(line.length).toBeLessThanOrEqual(170);
    expect(out.join("").length).toBeLessThan(raw.join("").length / 4);
  });

  it("her sürümün ilk üç maddesi için satırlar sınırda kalır", () => {
    for (const c of CHANGELOG) {
      for (const line of updateHighlights(c.tr)) {
        expect(line.length, `${c.v}: ${line}`).toBeLessThanOrEqual(170);
      }
      for (const line of updateHighlights(c.en)) {
        expect(line.length, `${c.v} en: ${line}`).toBeLessThanOrEqual(170);
      }
    }
  });
});
