import { describe, it, expect } from "vitest";
import {
  isAvailable, toggleAvail, availableDrivers, stintsWithoutDriver,
  pruneAssignments, buildAvailGrid,
} from "./avail";

const R = ["Ali", "Veli", "Ayşe"];

describe("avail — varsayılan uygunluk", () => {
  it("düğüm yoksa herkes her stintte uygun", () => {
    expect(isAvailable(null, "Ali", 0)).toBe(true);
    expect(isAvailable({}, "Ali", 7)).toBe(true);
  });
  it("listede olan stint uygun DEĞİL", () => {
    const a = { Ali: [1, 3] };
    expect(isAvailable(a, "Ali", 1)).toBe(false);
    expect(isAvailable(a, "Ali", 2)).toBe(true);
    expect(isAvailable(a, "Veli", 1)).toBe(true);
  });
  it("RTDB seyrek dizisi (null delikli) çökertmez", () => {
    expect(isAvailable({ Ali: [null, 2] }, "Ali", 2)).toBe(false);
    expect(isAvailable({ Ali: { 0: 4 } }, "Ali", 4)).toBe(false);
  });
});

describe("avail — hücre çevirme", () => {
  it("çevirince ekler, tekrar çevirince siler", () => {
    const a1 = toggleAvail({}, "Ali", 2);
    expect(a1).toEqual({ Ali: [2] });
    expect(toggleAvail(a1, "Ali", 2)).toEqual({});
  });
  it("liste boşalınca anahtar tamamen düşer (varsayılana dönüş)", () => {
    expect(toggleAvail({ Ali: [5] }, "Ali", 5)).not.toHaveProperty("Ali");
  });
  it("sıralı tutar ve girdiyi MUTASYONA UĞRATMAZ", () => {
    const src = { Ali: [5] };
    const out = toggleAvail(toggleAvail(src, "Ali", 1), "Ali", 3);
    expect(out.Ali).toEqual([1, 3, 5]);
    expect(src).toEqual({ Ali: [5] });
  });
});

describe("avail — stint başına uygun pilotlar", () => {
  it("kadro sırasını korur", () => {
    expect(availableDrivers({ Veli: [0] }, R, 0)).toEqual(["Ali", "Ayşe"]);
  });
  it("hiç uygun pilot kalmayan stintleri bulur (amber uyarı)", () => {
    const a = { Ali: [1], Veli: [1], Ayşe: [1] };
    expect(stintsWithoutDriver(a, R, 3)).toEqual([1]);
    expect(stintsWithoutDriver({}, R, 3)).toEqual([]);
  });
  it("kadro boşsa her stint uyarı verir", () => {
    expect(stintsWithoutDriver({}, [], 2)).toEqual([0, 1]);
  });
});

describe("avail — geçersiz atamaların temizlenmesi", () => {
  it("uygun değil işaretlenen pilotun ataması otomatik kalkar", () => {
    expect(pruneAssignments({ Ali: [1] }, ["Ali", "Ali", "Veli"]))
      .toEqual(["Ali", "", "Veli"]);
  });
  it("değişiklik yoksa AYNI dizi döner (gereksiz senkron yok)", () => {
    const cur = ["Ali", "Veli"];
    expect(pruneAssignments({ Ayşe: [0] }, cur)).toBe(cur);
    expect(pruneAssignments(null, cur)).toBe(cur);
  });
  it("boş atamalara dokunmaz", () => {
    expect(pruneAssignments({ Ali: [0] }, ["", ""])).toEqual(["", ""]);
  });
});

describe("avail — pencere ızgarası", () => {
  it("satır = pilot, hücre = stint; varsayılan hepsi uygun", () => {
    const g = buildAvailGrid({}, R, 3);
    expect(g).toHaveLength(3);
    expect(g[0].name).toBe("Ali");
    expect(g[0].cells.map((c) => c.ok)).toEqual([true, true, true]);
    expect(g[0].offCount).toBe(0);
  });
  it("uygun olmayan hücreleri ve sayısını verir", () => {
    const g = buildAvailGrid({ Veli: [0, 2] }, R, 3);
    expect(g[1].cells.map((c) => c.ok)).toEqual([false, true, false]);
    expect(g[1].offCount).toBe(2);
  });
});
