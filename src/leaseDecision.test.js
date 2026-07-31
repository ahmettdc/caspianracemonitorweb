import { describe, it, expect } from "vitest";
import { leaseDecision } from "./leaseDecision.js";

const field = [{ pos: 1 }];   // dolu saha (en az bir araç)

describe("leaseDecision — canlı köprü yazma kararı", () => {
  it("oyun kapalı / seans yok (0 araç) → yazma", () => {
    expect(leaseDecision({ field: [], driving: true }, true)).toBe("skip-empty");
    expect(leaseDecision({ driving: true }, true)).toBe("skip-empty");
    expect(leaseDecision(null, true)).toBe("skip-empty");
  });

  it("izleyici / garaj (driving false) → yazma, kilidi tutsa bile", () => {
    expect(leaseDecision({ field, driving: false }, true)).toBe("skip-spectator");
    expect(leaseDecision({ field, driving: false }, false)).toBe("skip-spectator");
  });

  it("süren ama kilit başkasında (held false) → yazma", () => {
    expect(leaseDecision({ field, driving: true }, false)).toBe("skip-other");
  });

  it("süren ve kilit bizde (held true) → yaz", () => {
    expect(leaseDecision({ field, driving: true }, true)).toBe("write");
  });

  it("driving alanı yoksa (eski/uyumsuz kare) izleyici sayılmaz → kilit varsa yazar", () => {
    expect(leaseDecision({ field }, true)).toBe("write");
    expect(leaseDecision({ field }, false)).toBe("skip-other");
  });
});
