import { describe, it, expect } from "vitest";
import { finishLabel, isRetired, pitPhase, pitRequested, pitChip } from "./liveStatus";

describe("finishLabel", () => {
  it("struct kodlarını eşler (0=yok, 1=finished, 2=dnf, 3=dq)", () => {
    expect(finishLabel({ finishStatus: 0 })).toBe(null);
    expect(finishLabel({ finishStatus: 1 })).toBe("FIN");
    expect(finishLabel({ finishStatus: 2 })).toBe("DNF");
    expect(finishLabel({ finishStatus: 3 })).toBe("DSQ");
  });
  it("alan yoksa (eski köprü) null — özellik sessizce kaybolur", () => {
    expect(finishLabel({})).toBe(null);
    expect(finishLabel(null)).toBe(null);
  });
  it("bilinmeyen/bozuk kodda uydurma etiket üretmez", () => {
    expect(finishLabel({ finishStatus: 9 })).toBe(null);
    expect(finishLabel({ finishStatus: -1 })).toBe(null);
    expect(finishLabel({ finishStatus: "abc" })).toBe(null);
    expect(finishLabel({ finishStatus: 1.5 })).toBe(null);
  });
});

describe("isRetired", () => {
  it("yalnız DNF/DSQ bırakmış sayılır", () => {
    expect(isRetired({ finishStatus: 2 })).toBe(true);
    expect(isRetired({ finishStatus: 3 })).toBe(true);
  });
  it("FIN bırakma DEĞİLDİR — yarış bitince herkes 1 olur", () => {
    expect(isRetired({ finishStatus: 1 })).toBe(false);
  });
  it("yarışta / veri yok → false", () => {
    expect(isRetired({ finishStatus: 0 })).toBe(false);
    expect(isRetired({})).toBe(false);
    expect(isRetired(null)).toBe(false);
  });
});

describe("pitPhase", () => {
  it("struct kodlarını eşler (1=request … 4=exiting)", () => {
    expect(pitPhase({ pitState: 0 })).toBe(null);
    expect(pitPhase({ pitState: 1 })).toBe("request");
    expect(pitPhase({ pitState: 2 })).toBe("entering");
    expect(pitPhase({ pitState: 3 })).toBe("stopped");
    expect(pitPhase({ pitState: 4 })).toBe("exiting");
  });
  it("alan yoksa / bozuksa null", () => {
    expect(pitPhase({})).toBe(null);
    expect(pitPhase({ pitState: 7 })).toBe(null);
    expect(pitPhase(null)).toBe(null);
  });
});

describe("pitRequested", () => {
  it("yalnız 'request' (araç HÂLÂ PİSTTE) true", () => {
    expect(pitRequested({ pitState: 1 })).toBe(true);
    expect(pitRequested({ pitState: 3 })).toBe(false);   // çoktan durmuş
    expect(pitRequested({})).toBe(false);
  });
});

describe("pitChip", () => {
  it("her aşama için kendi çipini verir", () => {
    expect(pitChip({ pitState: 1 })).toEqual({ txt: "ÇAĞRI", tone: "warn" });
    expect(pitChip({ pitState: 2 })).toEqual({ txt: "GİRİŞ", tone: "pit" });
    expect(pitChip({ pitState: 3 })).toEqual({ txt: "DURDU", tone: "pit" });
    expect(pitChip({ pitState: 4 })).toEqual({ txt: "ÇIKIŞ", tone: "pit" });
  });

  it("ÇAĞRI 'warn' tonundadır — diğer aşamalardan ayrılmalı (erken uyarı)", () => {
    expect(pitChip({ pitState: 1 }).tone).toBe("warn");
    expect(pitChip({ pitState: 2 }).tone).toBe("pit");
  });

  it("pitState YOKSA eski davranışa düşer (inPits → PIT)", () => {
    expect(pitChip({ inPits: true })).toEqual({ txt: "PIT", tone: "pit" });
    expect(pitChip({ inPits: false })).toBe(null);
    expect(pitChip({})).toBe(null);
    expect(pitChip(null)).toBe(null);
  });

  it("pitState VARSA o kazanır — inPits ile çelişse bile aşama gösterilir", () => {
    // araç pit yolunda ama aşama 'exiting' → tek düz "PIT" yerine ÇIKIŞ
    expect(pitChip({ pitState: 4, inPits: true }).txt).toBe("ÇIKIŞ");
    // çağrı aşamasında araç HÂLÂ PİSTTE (inPits false) → çip yine görünmeli
    expect(pitChip({ pitState: 1, inPits: false }).txt).toBe("ÇAĞRI");
  });
});
