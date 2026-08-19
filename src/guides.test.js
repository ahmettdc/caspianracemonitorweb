import { describe, it, expect } from "vitest";
import { GUIDES, guideFor } from "./guides";
import { SCREENS } from "./nav";

describe("guides — rehber kutuları (README §17)", () => {
  it("i18n-EN.md §1'deki 12 ekranın hepsi var", () => {
    expect(Object.keys(GUIDES).sort()).toEqual(
      ["chat", "dash", "drivers", "fuel", "home", "live", "official",
        "setup", "stint", "team", "tele", "tyre"]);
  });

  it("her rehber kimliği gerçek bir ekrana karşılık geliyor", () => {
    for (const id of Object.keys(GUIDES)) expect(SCREENS).toContain(id);
  });

  it("her kayıtta başlık ve tek satır açıklama var", () => {
    for (const [id, g] of Object.entries(GUIDES)) {
      expect(g.title, id).toBeTruthy();
      expect(g.text, id).toBeTruthy();
      expect(g.text.includes("\n"), id).toBe(false);
    }
  });

  it("code80 Stint rehberini kullanır", () => {
    expect(guideFor("code80")).toEqual(guideFor("stint"));
  });

  it("rehberi olmayan ekran null döner (pick/data/rchat)", () => {
    for (const s of ["pick", "data", "rchat", "yok"]) expect(guideFor(s)).toBeNull();
  });

  it("t() ile çevrilir", () => {
    const t = (s) => `EN:${s}`;
    expect(guideFor("live", t).title).toBe("EN:Canlı timing");
    expect(guideFor("live", t).text.startsWith("EN:")).toBe(true);
  });
});
