import { describe, it, expect } from "vitest";
import {
  SCREENS, RACE_SCREENS, isScreen, normalizeScreen, isWorkspaceScreen,
  showsRaceBar, RACEBAR_SCREENS, pushScreen, popScreen, hashForScreen, screenFromHash,
} from "./nav";

describe("nav — ekran kümesi", () => {
  it("ray sırası README'deki sırayla aynı", () => {
    expect(RACE_SCREENS).toEqual(
      ["dash", "stint", "fuel", "live", "tyre", "drivers", "tele", "setup"]);
  });
  it("tam sayfaya taşınan dördü de ekran kümesinde", () => {
    for (const s of ["team", "chat", "tele", "setup"]) expect(SCREENS).toContain(s);
  });
  it("code80 ayrı ekran değil ama geçerli", () => {
    expect(SCREENS).not.toContain("code80");
    expect(isScreen("code80")).toBe(true);
  });
  it("bilinmeyen değer fallback'e iner", () => {
    expect(normalizeScreen("yok")).toBe("home");
    expect(normalizeScreen("", "dash")).toBe("dash");
    expect(normalizeScreen("live")).toBe("live");
  });
});

describe("nav — kabuk kararları", () => {
  it("lobi ekranları çalışma alanı değil", () => {
    for (const s of ["home", "pick", "data", "official"]) {
      expect(isWorkspaceScreen(s)).toBe(false);
    }
  });
  it("yarış ve tam sayfa ekranları çalışma alanı", () => {
    for (const s of ["dash", "live", "team", "chat", "setup"]) {
      expect(isWorkspaceScreen(s)).toBe(true);
    }
  });
  it("yarış çubuğu prototipteki isRace altılısında çizilir", () => {
    for (const s of RACEBAR_SCREENS) expect(showsRaceBar(s)).toBe(true);
    expect(RACEBAR_SCREENS).toEqual(["dash", "stint", "fuel", "live", "tyre", "drivers"]);
    expect(showsRaceBar("code80")).toBe(true);
    expect(showsRaceBar("rchat")).toBe(true);
  });
  it("Telemetri · Setup · Takım · Sohbet · lobide çubuk yok", () => {
    for (const s of ["tele", "setup", "team", "chat", "home", "official"]) {
      expect(showsRaceBar(s)).toBe(false);
    }
  });
});

describe("nav — geri yığını", () => {
  it("aynı ekrana arka arkaya gidiş yığına yazılmaz", () => {
    const a = pushScreen(["home"], "live");
    expect(a).toEqual(["home", "live"]);
    expect(pushScreen(a, "live")).toBe(a);
  });
  it("geri bir adım önceki ekrana döner (pencere kapatmaz)", () => {
    const stack = ["home", "dash", "team"];
    expect(popScreen(stack)).toEqual({ stack: ["home", "dash"], screen: "dash" });
  });
  it("tek elemanlı yığın geri gitmez", () => {
    expect(popScreen(["home"])).toEqual({ stack: ["home"], screen: "home" });
    expect(popScreen([])).toEqual({ stack: [], screen: "home" });
  });
  it("yığın 30 ile sınırlı — uzun oturumda büyümez", () => {
    let s = ["home"];
    for (let i = 0; i < 100; i++) s = pushScreen(s, i % 2 ? "live" : "dash");
    expect(s.length).toBe(30);
  });
});

describe("nav — hash eşlemesi (Tauri'de de çalışır)", () => {
  it("ekran → hash", () => expect(hashForScreen("live")).toBe("#/live"));
  it("bilinmeyen ekran → #/home", () => expect(hashForScreen("yok")).toBe("#/home"));
  it("hash → ekran", () => {
    expect(screenFromHash("#/tyre")).toBe("tyre");
    expect(screenFromHash("#tyre")).toBe("tyre");
    expect(screenFromHash("#/live?x=1")).toBe("live");
    expect(screenFromHash("")).toBe("home");
    expect(screenFromHash("#/bilinmeyen", "dash")).toBe("dash");
  });
});
