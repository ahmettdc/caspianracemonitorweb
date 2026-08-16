import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { APP_VERSION } from "./constants";
import { CHANGELOG } from "./changelog";

/* Sürüm DÖRT yerde duruyor: package.json, src/constants.js (APP_VERSION),
   src-tauri/tauri.conf.json ve src/changelog.js'teki ilk kayıt. changelog.js
   başlığındaki sözleşme bunu yazıyor ama hiçbir şey doğrulamıyordu; masaüstü
   iş akışı da (desktop.yml) sürümlerin farklı olmasına dayanıyor.
   Bir yeri güncelleyip diğerini unutmak sessizce geçiyordu — burada kilitli. */
const readJson = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));

describe("sürüm tutarlılığı (dört dosya)", () => {
  const pkg = readJson("../package.json");
  const tauri = readJson("../src-tauri/tauri.conf.json");

  it("APP_VERSION 'v' önekli semver", () => {
    expect(APP_VERSION).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  it("package.json sürümü APP_VERSION ile aynı", () => {
    expect(`v${pkg.version}`).toBe(APP_VERSION);
  });

  it("src-tauri/tauri.conf.json sürümü APP_VERSION ile aynı", () => {
    expect(`v${tauri.version}`).toBe(APP_VERSION);
  });

  it("changelog'un İLK kaydı APP_VERSION ile aynı (en yeni en üstte)", () => {
    expect(CHANGELOG[0].v).toBe(APP_VERSION);
  });

  it("changelog kayıtları en yeniden eskiye sıralı", () => {
    /* Eski kayıtlarda iki parçalı sürümler de var (ör. v1.4) → eksik parça 0. */
    const key = (v) => {
      const [a = 0, b = 0, c = 0] = v.replace(/^v/, "").split(".").map(Number);
      return a * 1e6 + b * 1e3 + c;
    };
    for (let i = 1; i < CHANGELOG.length; i++) {
      expect(key(CHANGELOG[i - 1].v), `${CHANGELOG[i - 1].v} > ${CHANGELOG[i].v}`)
        .toBeGreaterThanOrEqual(key(CHANGELOG[i].v));
    }
  });

  it("her kayıtta v/date/tr/en var ve tr ile en AYNI uzunlukta", () => {
    for (const e of CHANGELOG) {
      expect(e.v, JSON.stringify(e.v)).toMatch(/^v\d+\.\d+(\.\d+)?$/);
      expect(e.date, e.v).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Array.isArray(e.tr), e.v).toBe(true);
      expect(Array.isArray(e.en), e.v).toBe(true);
      expect(e.tr.length, `${e.v}: tr boş`).toBeGreaterThan(0);
      expect(e.en.length, `${e.v}: tr ${e.tr.length} ≠ en ${e.en.length}`).toBe(e.tr.length);
    }
  });
});
