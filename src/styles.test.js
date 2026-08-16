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

/* Tanımsız token sessizce "hiç" olarak çözümlenir: kural yazılmış görünür ama
   eleman zeminsiz/renksiz kalır. Bu PR'da iki tanesi bulundu (--panel3 hiç
   tanımlı değildi, --text ise --txt'nin yazım hatasıydı). */
describe("styles.js — kullanılan her --token tanımlı", () => {
  const src = readFileSync(new URL("./styles.js", import.meta.url), "utf8");

  /* Eleman düzeyinde (inline style ile) atanan tokenlar — :root'ta OLMAMALI,
     çünkü değerleri veriye bağlı. Listeye ekleme yaparken atandığı yeri yaz. */
  const ELEMENT_SCOPED = new Set([
    "--c",   // src/tabs/DriversTab.jsx — pilot rengi, satır bazında atanır
  ]);

  it("var(--x) ile çağrılan her token :root'ta ya da eleman düzeyinde tanımlı", () => {
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
    const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const missing = [...used]
      .filter((v) => !defined.has(v) && !ELEMENT_SCOPED.has(v)).sort();
    expect(missing, `tanımsız token: ${missing.join(", ")}`).toEqual([]);
  });

  it("stylesheet'te var(--text) yazım hatası yok (doğrusu --txt)", () => {
    expect(src).not.toContain("var(--text)");
  });
});
