import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/* App.jsx TDZ tuzağı (v2.0'da İKİ KEZ ısırdı: curTeam ve setRdOpen).
   ------------------------------------------------------------------
   React'te useMemo/useEffect/useCallback geri çağrıları render sırasında,
   KAYNAK SIRASIYLA çalışır. Bu geri çağrılardan biri, dosyada DAHA SONRA
   `const [..,setX]=useState()` ile tanımlanan bir setter'ı okursa, o setter'ın
   okunduğu render'da henüz init olmadığı için
   "Cannot access 'setX' before initialization" ile çöker.

   Bunu ne oxlint (no-use-before-define, iç içe fonksiyon gövdesindeki referansı
   "sonra çağrılır" sayıp atlıyor) ne de birim testleri (App render edilmiyor)
   ne de login-ekranına-kadar-giden tarayıcı açılış kontrolü yakalıyordu — çünkü
   crash yalnız `tour` truthy iken görünür. Bu test o boşluğu kapatır. */
const src = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

/* useState/useReducer ile tanımlanan setter → ilk tanım karakter indeksi. */
const setterDecl = {};
for (const m of src.matchAll(/const\s*\[\s*\w+\s*,\s*(set\w+)\s*\]\s*=\s*use(?:State|Reducer)\(/g)) {
  if (!(m[1] in setterDecl)) setterDecl[m[1]] = m.index;
}

/* Render sırasında koşan hook geri çağrılarının gövdelerini (yaklaşık) çıkar:
   `useMemo(`/`useEffect(`/`useCallback(` başından, bağımlılık dizisiyle biten
   `], ...)` ya da parametresiz `)` kapanışına kadar. Amaç kesin ayrıştırma değil,
   bu dosyadaki hook'ları kabaca sınırlamak. */
function hookBodies() {
  const out = [];
  const re = /use(?:Memo|Effect|Callback)\(/g;
  let m;
  while ((m = re.exec(src))) {
    const start = m.index;
    // dengeli parantezle hook çağrısının sonunu bul
    let i = re.lastIndex - 1, depth = 0, end = -1;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === "(") depth++;
      else if (c === ")") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end > start) out.push([start, end]);
  }
  return out;
}

describe("App.jsx — hook TDZ koruması", () => {
  it("render sırasında koşan hiçbir hook, kendinden SONRA tanımlanan bir useState "
    + "setter'ını okumaz (curTeam/setRdOpen sınıfı çökme)", () => {
    const bodies = hookBodies();
    const violations = [];
    for (const [start, end] of bodies) {
      const body = src.slice(start, end);
      for (const [setter, declIdx] of Object.entries(setterDecl)) {
        if (declIdx > start && new RegExp(`\\b${setter}\\b`).test(body)) {
          const line = src.slice(0, start).split("\n").length;
          violations.push(`sat.${line}: hook '${setter}'i tanımından önce okuyor`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("rdOpen/rdDraft, onları okuyan tourSteps useMemo'sundan ÖNCE tanımlı", () => {
    const decl = src.search(/const\s*\[\s*rdOpen\s*,\s*setRdOpen\s*\]/);
    const use = src.search(/const\s+tourSteps\s*=\s*useMemo\(/);
    expect(decl).toBeGreaterThan(-1);
    expect(use).toBeGreaterThan(-1);
    expect(decl).toBeLessThan(use);
  });
});
