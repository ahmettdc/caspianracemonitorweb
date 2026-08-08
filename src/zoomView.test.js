import { describe, it, expect } from "vitest";
import { clampView, zoomViewAt, panView, zoomDomain, advanceCursor } from "./zoomView";

const S = 240;

describe("clampView", () => {
  it("fit dışına taşmayı engeller (vw en fazla S)", () => {
    const v = clampView({ vx: -50, vy: 0, vw: 400, vh: 400 }, S);
    expect(v).toEqual({ vx: 0, vy: 0, vw: S, vh: S });
  });
  it("maxZoom sınırı: vw en az S/maxZoom", () => {
    const v = clampView({ vx: 0, vy: 0, vw: 1, vh: 1 }, S, 10);
    expect(v.vw).toBeCloseTo(24);
    expect(v.vh).toBeCloseTo(24);
  });
  it("pan sınıra klamplenir (vx ∈ [0, S-vw])", () => {
    const v = clampView({ vx: 500, vy: -20, vw: 120, vh: 120 }, S);
    expect(v.vx).toBe(120);   // S - vw
    expect(v.vy).toBe(0);
  });
});

describe("zoomViewAt", () => {
  it("yakınlaşmada anchor noktası sabit kalır", () => {
    const v0 = { vx: 0, vy: 0, vw: S, vh: S };
    const ax = 60, ay = 180;
    const v1 = zoomViewAt(v0, ax, ay, 0.5, S);
    expect(v1.vw).toBeCloseTo(120);
    // anchor'ın viewBox içindeki oranı korunmalı
    expect((ax - v1.vx) / v1.vw).toBeCloseTo((ax - v0.vx) / v0.vw);
    expect((ay - v1.vy) / v1.vh).toBeCloseTo((ay - v0.vy) / v0.vh);
  });
  it("uzaklaşma fit'i (S) aşmaz", () => {
    const v = zoomViewAt({ vx: 60, vy: 60, vw: 120, vh: 120 }, 120, 120, 4, S);
    expect(v.vw).toBe(S);
    expect(v.vh).toBe(S);
    expect(v.vx).toBe(0);
  });
});

describe("panView", () => {
  it("kaydırır ve sınıra klampler", () => {
    const v = panView({ vx: 60, vy: 60, vw: 120, vh: 120 }, 40, -40, S);
    expect(v.vx).toBe(100);
    expect(v.vy).toBe(20);
  });
  it("sağ sınırı aşmaz", () => {
    const v = panView({ vx: 100, vy: 0, vw: 120, vh: 120 }, 999, 0, S);
    expect(v.vx).toBe(120);   // S - vw
  });
});

describe("advanceCursor", () => {
  it("hız ve süreye göre ilerler (1x: N-1 nokta lapSec'te)", () => {
    // N=601, lapSec=60 → perMs=600/60000=0.01 → 1000ms tick → +10
    expect(advanceCursor(0, 601, 60, 1, 1000)).toBeCloseTo(10);
    expect(advanceCursor(0, 601, 60, 2, 1000)).toBeCloseTo(20);   // 2x iki katı
  });
  it("sona gelince başa sarar", () => {
    expect(advanceCursor(599, 601, 60, 1, 1000)).toBe(0);   // 599+10 >= 600 → 0
  });
  it("bozuk N → 0", () => {
    expect(advanceCursor(5, 1, 60, 1, 40)).toBe(0);
    expect(advanceCursor(5, 0, 60, 1, 40)).toBe(0);
  });
  it("lapSec yoksa yedek süre (8s) kullanır, çökmez", () => {
    expect(advanceCursor(0, 601, 0, 1, 1000)).toBeGreaterThan(0);
  });
});

describe("zoomDomain", () => {
  const range = [0, 1000];
  it("anchor etrafında daraltır (anchor oranı korunur)", () => {
    const w = zoomDomain([0, 1000], 500, 0.5, range);
    expect(w[1] - w[0]).toBeCloseTo(500);
    expect(w[0]).toBeCloseTo(250);
    expect(w[1]).toBeCloseTo(750);
  });
  it("veri aralığı dışına taşmaz (sol kenar anchor)", () => {
    const w = zoomDomain([0, 1000], 0, 0.5, range);
    expect(w[0]).toBe(0);
    expect(w[1]).toBeCloseTo(500);
  });
  it("tam genişliğe/üstüne dönünce null", () => {
    expect(zoomDomain([200, 700], 450, 3, range)).toBeNull();
    expect(zoomDomain(null, 500, 1.5, range)).toBeNull();
  });
  it("minSpan altına inmez", () => {
    const w = zoomDomain([490, 510], 500, 0.1, range, 0.02);
    expect(w[1] - w[0]).toBeCloseTo(20);   // full*0.02
  });
});
