import { describe, it, expect } from "vitest";
import {
  SETUP_MAX_BYTES, SETUP_LIMITS, fileTooBig, filterSetups,
  poolEmptyReason, trimSetupMeta, staleTrackFilter,
} from "./setupPool";

const pool = [
  { id: "a", track: "spa", cond: "dry", sess: "R" },
  { id: "b", track: "spa", cond: "wet", sess: "Q" },
  { id: "c", track: "monza", cond: "dry", sess: "Q" },
];

describe("fileTooBig", () => {
  it("sınırın altı/üstü", () => {
    expect(fileTooBig(SETUP_MAX_BYTES - 1)).toBe(false);
    expect(fileTooBig(SETUP_MAX_BYTES)).toBe(false);      // tam sınır kabul
    expect(fileTooBig(SETUP_MAX_BYTES + 1)).toBe(true);
  });
  it("tipik setup dosyası (birkaç KB) geçer, 1 MB geçmez", () => {
    expect(fileTooBig(8 * 1024)).toBe(false);
    expect(fileTooBig(1024 * 1024)).toBe(true);
  });
});

describe("filterSetups", () => {
  it("süzgeç yoksa hepsi", () => {
    expect(filterSetups(pool, {})).toHaveLength(3);
    expect(filterSetups(pool)).toHaveLength(3);
  });
  it("tek süzgeç", () => {
    expect(filterSetups(pool, { track: "spa" }).map((x) => x.id)).toEqual(["a", "b"]);
    expect(filterSetups(pool, { cond: "wet" }).map((x) => x.id)).toEqual(["b"]);
    expect(filterSetups(pool, { sess: "Q" }).map((x) => x.id)).toEqual(["b", "c"]);
  });
  it("kombinasyon (AND)", () => {
    expect(filterSetups(pool, { track: "spa", sess: "Q" }).map((x) => x.id)).toEqual(["b"]);
    expect(filterSetups(pool, { track: "monza", cond: "wet" })).toHaveLength(0);
  });
  it("bozuk girdi patlamaz", () => {
    expect(filterSetups(null, { track: "spa" })).toEqual([]);
    expect(filterSetups(undefined)).toEqual([]);
  });
});

describe("poolEmptyReason", () => {
  it("havuz gerçekten boş → none", () => {
    expect(poolEmptyReason(0, 0)).toBe("none");
  });
  it("havuz dolu ama süzgeç eledi → filtered (REGRESYON: eskiden 'henüz setup yok' deniyordu)", () => {
    expect(poolEmptyReason(50, 0)).toBe("filtered");
    expect(poolEmptyReason(1, 0)).toBe("filtered");
  });
  it("liste doluysa mesaj yok", () => {
    expect(poolEmptyReason(50, 3)).toBeNull();
    expect(poolEmptyReason(1, 1)).toBeNull();
  });
});

describe("trimSetupMeta", () => {
  it("champ/ver/note sözleşme uzunluklarına kırpılır", () => {
    const out = trimSetupMeta({
      track: "spa",
      champ: "x".repeat(80), ver: "v".repeat(40), note: "n".repeat(300),
    });
    expect(out.champ).toHaveLength(SETUP_LIMITS.champ);
    expect(out.ver).toHaveLength(SETUP_LIMITS.ver);
    expect(out.note).toHaveLength(SETUP_LIMITS.note);
  });
  it("baştaki/sondaki boşluk temizlenir, diğer alanlar korunur", () => {
    const out = trimSetupMeta({ track: "spa", cls: "gt3", car: "bmw",
      champ: "  ELMS  ", ver: " V1.2 ", note: "  düşük kanat " });
    expect(out.champ).toBe("ELMS");
    expect(out.ver).toBe("V1.2");
    expect(out.note).toBe("düşük kanat");
    expect(out.track).toBe("spa");
    expect(out.cls).toBe("gt3");
    expect(out.car).toBe("bmw");
  });
  it("eksik alanlar boş dizeye düşer (undefined yazılmaz)", () => {
    const out = trimSetupMeta({ track: "spa" });
    expect(out.champ).toBe("");
    expect(out.ver).toBe("");
    expect(out.note).toBe("");
  });
});

describe("staleTrackFilter", () => {
  it("seçili pist havuzda yoksa true (hayalet süzgeç)", () => {
    expect(staleTrackFilter(pool, "lemans")).toBe(true);
  });
  it("seçili pist havuzda varsa false", () => {
    expect(staleTrackFilter(pool, "spa")).toBe(false);
    expect(staleTrackFilter(pool, "monza")).toBe(false);
  });
  it("süzgeç boşsa asla bayat değil", () => {
    expect(staleTrackFilter(pool, "")).toBe(false);
    expect(staleTrackFilter([], "")).toBe(false);
  });
  it("bozuk girdi patlamaz", () => {
    expect(staleTrackFilter(null, "spa")).toBe(true);
  });
});
