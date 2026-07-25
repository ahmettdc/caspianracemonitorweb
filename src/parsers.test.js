import { describe, it, expect } from "vitest";
import { isLapLabel, msFromCell, splitCsvLine, tnum } from "./parsers.js";

describe("isLapLabel", () => {
  it("tur etiketlerini tanır, diğerlerini reddeder", () => {
    expect(isLapLabel("Lap 5")).toBe(true);
    expect(isLapLabel("Out Lap")).toBe(true);
    expect(isLapLabel("in lap")).toBe(true);
    expect(isLapLabel("outlap")).toBe(true);
    expect(isLapLabel("Sector 1")).toBe(false);
    expect(isLapLabel("Fuel")).toBe(false);
  });
});

describe("msFromCell", () => {
  it("m:ss.d biçimini milisaniyeye çevirir", () => {
    expect(msFromCell("1:30.5")).toBe(90500);
    expect(msFromCell("1:05")).toBe(65000);
    expect(msFromCell("0:59,99")).toBe(59990); // virgül ondalık
  });
  it("çıplak sayıları birime göre yorumlar", () => {
    expect(msFromCell("45.2")).toBe(45200);   // saniye (30–1200)
    expect(msFromCell("150000")).toBe(150000); // zaten ms (>20000)
    expect(msFromCell("10")).toBeNull();        // belirsiz aralık
    expect(msFromCell("abc")).toBeNull();
  });
});

describe("tnum", () => {
  it("sayı ayrıştırır, geçersizde null", () => {
    expect(tnum("3.5")).toBe(3.5);
    expect(tnum("3,5")).toBe(3.5);
    expect(tnum("12x")).toBe(12);
    expect(tnum("")).toBeNull();
    expect(tnum(null)).toBeNull();
    expect(tnum("abc")).toBeNull();
  });
});

describe("splitCsvLine", () => {
  it("basit ayırma ve trim", () => {
    expect(splitCsvLine("a, b ,c", ",")).toEqual(["a", "b", "c"]);
  });
  it("tırnak içindeki ayırıcıyı korur", () => {
    expect(splitCsvLine('"a,b",c', ",")).toEqual(["a,b", "c"]);
  });
  it("çift tırnak kaçışını çözer", () => {
    expect(splitCsvLine('"he said ""hi""",x', ",")).toEqual(['he said "hi"', "x"]);
  });
});
