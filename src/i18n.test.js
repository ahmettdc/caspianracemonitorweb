/* i18n bütünlük testleri (v2.4.1).

   Bu kod tabanı iki kez aynı hataya düştü, bu yüzden denetim teste bağlandı:

   1) YİNELENEN ANAHTAR SESSİZCE EZİYOR. Sözlük düz bir nesne olduğu için aynı
      anahtarın ikinci yazımı birincisini yok ediyor. Ölçülen sonuç: setup
      yükleme bölümündeki "Yükleniyor…": "Uploading…" genel yükleme metnini
      ("Loading…") eziyordu ve EN dilinde uygulama açılış iskeleti, Suspense
      fallback'leri ve sohbet kanal listesi "Uploading…" yazıyordu.
   2) EKSİK ANAHTAR TÜRKÇE BIRAKIYOR. `t()` bulamadığı anahtarı kaynak metinle
      döndürüyor → EN modunda ekranda Türkçe kalıyor, hata hiçbir yere düşmüyor. */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { EN } from "./i18n.js";

const SRC = new URL("./", import.meta.url).pathname;
const I18N = join(SRC, "i18n.js");

/* "anahtar": "değer" — anahtar ile değer arasında satır sonu olabilir. */
const ENTRY = /"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;

function sourceFiles(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(js|jsx)$/.test(p) && !/\.test\./.test(p) && !p.endsWith("i18n.js")) out.push(p);
  }
  return out;
}

describe("i18n sözlüğü", () => {
  it("YİNELENEN ANAHTAR YOK (ikinci yazım birincisini sessizce eziyor)", () => {
    const s = readFileSync(I18N, "utf8");
    const seen = new Map();
    const dups = [];
    for (const m of s.matchAll(ENTRY)) {
      const line = s.slice(0, m.index).split("\n").length;
      if (seen.has(m[1])) dups.push(`"${m[1]}" — satır ${seen.get(m[1])} ve ${line}`);
      else seen.set(m[1], line);
    }
    expect(dups).toEqual([]);
  });

  it("t() ile çağrılan HER anahtarın EN karşılığı var", () => {
    const missing = [];
    for (const p of sourceFiles(SRC)) {
      const s = readFileSync(p, "utf8");
      for (const m of s.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) {
        const k = m[1].replace(/\\"/g, '"');
        if (!(k in EN)) {
          const line = s.slice(0, m.index).split("\n").length;
          missing.push(`${p.slice(p.indexOf("/src/") + 1)}:${line} → t("${k}")`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("hiçbir EN değeri boş değil", () => {
    expect(Object.entries(EN).filter(([, v]) => !String(v).trim()).map(([k]) => k)).toEqual([]);
  });
});
