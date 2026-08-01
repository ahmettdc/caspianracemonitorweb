import { describe, it, expect } from "vitest";
import { tyreTitle, tyreChangeBadge, teleStale, TELE_STALE_SEC } from "./tyreInfo.js";

describe("tyreTitle — dört köşe tooltip'i", () => {
  it("köşeleri araç düzeninde ve yüzde olarak yazar", () => {
    expect(tyreTitle({ tyres4: [0.92, 0.884, 0.79, 0.81] }))
      .toBe("ÖnSol 92% · ÖnSağ 88% · ArkaSol 79% · ArkaSağ 81%");
  });
  it("bileşimi ekler", () => {
    expect(tyreTitle({ tyres4: [1, 1, 1, 1], tyreComp: "Wet" }))
      .toBe("ÖnSol 100% · ÖnSağ 100% · ArkaSol 100% · ArkaSağ 100%\nBileşim: Wet");
  });
  it("veri yoksa boş (tooltip gösterilmez)", () => {
    expect(tyreTitle({})).toBe("");
    expect(tyreTitle(null)).toBe("");
    expect(tyreTitle({ tyres4: [0.5, 0.5] })).toBe("");     // eksik köşe
  });
  it("bayat telemetriyi UYARIR — donmuş değer gerçekmiş gibi görünmesin", () => {
    const s = tyreTitle({ tyres4: [1, 1, 1, 1], teleLag: 4.2 });
    expect(s).toContain("⚠");
    expect(s).toContain("4.2 sn geride");
    expect(tyreTitle({ tyres4: [1, 1, 1, 1], teleLag: 0.02 })).not.toContain("⚠");
  });
});

describe("teleStale", () => {
  it("eşik üstü bayat, altı taze; veri yoksa bayat DEĞİL (uyarı spam'i olmasın)", () => {
    expect(teleStale(TELE_STALE_SEC)).toBe(true);
    expect(teleStale(-3)).toBe(true);            // işaret önemsiz
    expect(teleStale(0.4)).toBe(false);
    expect(teleStale(null)).toBe(false);
    expect(teleStale(undefined)).toBe(false);
  });
});

describe("tyreChangeBadge — pit'te kaç lastik değişti", () => {
  it("iki lastik → sayı + taraf kısaltması", () => {
    const b = tyreChangeBadge({ n: 2, corners: ["fl", "fr"] });
    expect(b.txt).toBe("2 ÖN");
    expect(b.title).toBe("Son pitte 2 lastik değişti: ÖnSol · ÖnSağ");
  });
  it("eksen kalıpları: ARKA / SAĞ / SOL", () => {
    expect(tyreChangeBadge({ n: 2, corners: ["rl", "rr"] }).txt).toBe("2 ARKA");
    expect(tyreChangeBadge({ n: 2, corners: ["fr", "rr"] }).txt).toBe("2 SAĞ");
    expect(tyreChangeBadge({ n: 2, corners: ["fl", "rl"] }).txt).toBe("2 SOL");
  });
  it("kalıba uymayan ikili yalnız sayı gösterir (çapraz)", () => {
    expect(tyreChangeBadge({ n: 2, corners: ["fl", "rr"] }).txt).toBe("2");
  });
  it("dört lastik ve 'hiç değişmedi' ayrı ayrı okunur", () => {
    expect(tyreChangeBadge({ n: 4, corners: ["fl", "fr", "rl", "rr"] }).txt).toBe("4");
    const z = tyreChangeBadge({ n: 0, corners: [] });
    expect(z.txt).toBe("0");
    expect(z.title).toContain("değişmedi");
  });
  it("bileşim değişimi açıklamaya eklenir", () => {
    const b = tyreChangeBadge({ n: 4, corners: ["fl", "fr", "rl", "rr"], comp: "Wet" });
    expect(b.comp).toBe("Wet");
    expect(b.title).toContain("Bileşim → Wet");
  });
  it("veri yoksa rozet yok", () => {
    expect(tyreChangeBadge(null)).toBeNull();
    expect(tyreChangeBadge({})).toBeNull();
    expect(tyreChangeBadge({ n: "x" })).toBeNull();
  });
});
