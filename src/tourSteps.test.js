import { describe, it, expect, vi } from "vitest";
import { buildTourSteps, lobbySteps, coreSteps, liveSteps } from "./tourSteps";

/* t: kimlik (anahtar = Türkçe metin) — i18n'den bağımsız test */
const t = (s) => s;
const ctx = () => ({ t, setTab: vi.fn(), setSideOpen: vi.fn(), setTourDemo: vi.fn() });

const SECTIONS = ["lobby", "core", "live", "main"];

describe("tourSteps", () => {
  it("her bölüm dolu bir adım dizisi döndürür", () => {
    for (const s of SECTIONS) {
      const steps = buildTourSteps(s, ctx());
      expect(Array.isArray(steps), s).toBe(true);
      expect(steps.length, s).toBeGreaterThan(0);
    }
  });

  it("her adımda dolu title ve body vardır", () => {
    for (const s of SECTIONS) {
      for (const st of buildTourSteps(s, ctx())) {
        expect(typeof st.title, `${s}:title`).toBe("string");
        expect(st.title.trim().length, `${s}:${st.title}`).toBeGreaterThan(0);
        expect(typeof st.body, `${s}:body`).toBe("string");
        expect(st.body.trim().length, `${s}:${st.title}`).toBeGreaterThan(0);
      }
    }
  });

  it("sel değerleri bölüm içinde benzersizdir (aynı hedef iki kez vurgulanmaz)", () => {
    for (const s of SECTIONS) {
      const sels = buildTourSteps(s, ctx()).map((x) => x.sel).filter(Boolean);
      expect(new Set(sels).size, s).toBe(sels.length);
    }
  });

  it("sel varsa [data-tour='...'] biçimindedir", () => {
    for (const s of SECTIONS) {
      for (const st of buildTourSteps(s, ctx())) {
        if (st.sel) expect(st.sel, st.title).toMatch(/^\[data-tour='[a-z0-9-]+'\]$/);
      }
    }
  });

  it("act varsa fonksiyondur", () => {
    for (const s of SECTIONS) {
      for (const st of buildTourSteps(s, ctx())) {
        if (st.act !== undefined) expect(typeof st.act, st.title).toBe("function");
      }
    }
  });

  it("main = core + live (sıra korunur)", () => {
    const c = ctx();
    const main = buildTourSteps("main", c);
    const core = coreSteps(t, c);
    const live = liveSteps(t, c);
    expect(main.length).toBe(core.length + live.length);
    expect(main.map((x) => x.title))
      .toEqual([...core.map((x) => x.title), ...live.map((x) => x.title)]);
  });

  it("bilinmeyen bölüm main'e düşer", () => {
    const a = buildTourSteps("bilinmeyen", ctx()).map((x) => x.title);
    const b = buildTourSteps("main", ctx()).map((x) => x.title);
    expect(a).toEqual(b);
  });

  it("lobi adımları sekme/panel açmaz (act yok)", () => {
    for (const st of lobbySteps(t)) expect(st.act, st.title).toBeUndefined();
  });

  it("Canlı adımlarının HEPSİ Canlı sekmesini açar ve demoyu tetikler", () => {
    const c = ctx();
    const steps = liveSteps(t, c);
    expect(steps.length).toBeGreaterThanOrEqual(8);
    for (const st of steps) {
      expect(typeof st.act, st.title).toBe("function");
      st.act();
    }
    expect(c.setTab).toHaveBeenCalledTimes(steps.length);
    expect(c.setTab).toHaveBeenCalledWith("live");
    expect(c.setTourDemo).toHaveBeenCalledTimes(steps.length);
    expect(c.setTourDemo).toHaveBeenCalledWith(true);
  });

  it("Canlı bölümü Canlı Timing'in ana kutularını kapsar", () => {
    const sels = liveSteps(t, ctx()).map((x) => x.sel);
    for (const need of ["livedemo", "liveconn", "livesession", "ownlive",
      "livemap", "livefield", "livelapsbtn", "livepos", "livebig"]) {
      expect(sels, need).toContain(`[data-tour='${need}']`);
    }
  });

  it("core adımları sekmeleri/paneli açar (act'ler patlamadan çalışır)", () => {
    const c = ctx();
    for (const st of coreSteps(t, c)) if (st.act) st.act();
    expect(c.setTab).toHaveBeenCalled();
    expect(c.setSideOpen).toHaveBeenCalledWith(true);
  });
});
