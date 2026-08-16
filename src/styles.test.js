import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { css } from "./styles";

/* styles.js TEK bir template literal'dir (export const css = `…`). İçeride
   kaçırılmamış bir backtick literal'i erken kapatır ve dosya sessizce bozulur —
   lint ve birim testleri bunu yakalamaz, yalnız derleme/çalışma anında patlar.
   Bu tuzağa geliştirme sırasında iki kez düşüldüğü için kalıcı koruma. */
describe("styles.js — template literal bütünlüğü", () => {
  const src = readFileSync(new URL("./styles.js", import.meta.url), "utf8");

  it("dosyada YALNIZ iki backtick var (literal'in açılışı ve kapanışı)", () => {
    expect((src.match(/`/g) || []).length).toBe(2);
  });

  it("css dizesi çözümlenip dolu geliyor", () => {
    expect(typeof css).toBe("string");
    expect(css.length).toBeGreaterThan(50000);
  });

  it("literal içinde ${…} interpolasyonu yok (ham CSS kalmalı)", () => {
    expect(css).not.toMatch(/\$\{/);
  });

  it(":root token bloğu ve v2 kabuk sınıfları duruyor", () => {
    for (const tok of ["--panel-alt", "--rail-w", "--rd-w", "--z-racebar", "--t-panel"]) {
      expect(css, tok).toContain(tok);
    }
    for (const cls of [".rail", ".racebar", ".fieldtbl", ".rdpanel", ".v2page"]) {
      expect(css, cls).toContain(cls);
    }
  });
});
