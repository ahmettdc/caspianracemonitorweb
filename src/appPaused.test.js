import { describe, it, expect } from "vitest";
import { computePaused } from "./appPaused";

/* Sürüş Modu kararı — saf. isTauri/hidden/focused/bridgeLive → paused? */
describe("computePaused", () => {
  it("web (izleyici/mühendis) ASLA duraklamaz — render'a dokunulmaz", () => {
    expect(computePaused({ isTauri: false, hidden: true, focused: false, bridgeLive: true }))
      .toBe(false);
    expect(computePaused({ isTauri: false, hidden: false, focused: false, bridgeLive: true }))
      .toBe(false);
  });

  it("pencere gizli (tepside) → daima duraklat (gerçekten görünmez)", () => {
    expect(computePaused({ isTauri: true, hidden: true, focused: true, bridgeLive: false }))
      .toBe(true);
    expect(computePaused({ isTauri: true, hidden: true, focused: false, bridgeLive: false }))
      .toBe(true);
  });

  it("odak yok + köprü canlı yazıyor (sürüş PC'si yarışta) → duraklat", () => {
    expect(computePaused({ isTauri: true, hidden: false, focused: false, bridgeLive: true }))
      .toBe(true);
  });

  it("odak yok AMA köprü canlı yazmıyor → DURAKLAMAZ (ikinci monitör mühendisi korunur)", () => {
    expect(computePaused({ isTauri: true, hidden: false, focused: false, bridgeLive: false }))
      .toBe(false);
  });

  it("pencere görünür + odakta → normal render", () => {
    expect(computePaused({ isTauri: true, hidden: false, focused: true, bridgeLive: true }))
      .toBe(false);
    expect(computePaused({ isTauri: true, hidden: false, focused: true, bridgeLive: false }))
      .toBe(false);
  });
});
