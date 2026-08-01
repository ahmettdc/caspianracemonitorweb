/* ============================================================
   LASTİK HAMURU — saf sınıflandırıcı (React/Firebase bağımsız)
   ------------------------------------------------------------
   Köprü her aracın hamur ADINI telemetriden okuyup `tyreComp` olarak gönderiyor
   (v1.4.65: mFrontTireCompoundName). Bu ham metni Soft/Medium/Hard/Wet kademesine
   sınıflandırıp saha tablosunda ikonla gösteriyoruz.

   Dürüst kısıt: oyunun ürettiği GERÇEK stringler bu ortamda bilinemiyor (oyun yok).
   Bu yüzden eşleşme TOLERANSLI (anahtar kelime + tek-harf kodu) ve eşleşmezse null
   döner — UI ham kısaltmayı gösterir, uydurma yapılmaz. Saha kaymışsa buradaki
   kelime listeleri tek noktadan düzeltilir (--dump ile gerçek adlar okunur).
   tyreCompound.test.js doğrudan test eder.
   ============================================================ */

/* Kademe tanımları — renk ikonun YEDEĞİdir (ikon yüklenmezse disk rengi).
   Renkler kullanıcının ikonlarıyla aynı dil: soft beyaz · medium sarı · hard kırmızı
   · wet mavi (WEC/ELMS renkleri; F1'in tersi — ikonlarla tutarlı olsun diye). */
export const COMPOUNDS = {
  soft:   { short: "S", label: "Soft",   color: "#EDEDED" },
  medium: { short: "M", label: "Medium", color: "#F5C84C" },
  hard:   { short: "H", label: "Hard",   color: "#E53935" },
  wet:    { short: "W", label: "Wet",    color: "#2E86DE" },
};

/* Ham hamur adından kademe id'si. Sıra önemli: "wet"/"rain"/"inter" ıslak; "soft"
   yumuşak; "hard" sert; "medium"/"med" orta. Tek-harf kodu (S/M/H/W) de kabul. */
const RULES = [
  [/wet|rain|inter|full.?wet|monsoon/i, "wet"],
  [/soft/i, "soft"],
  [/hard/i, "hard"],
  [/medium|med(?![a-z])/i, "medium"],
];
const SHORT = { s: "soft", m: "medium", h: "hard", w: "wet" };

export function compoundClass(name) {
  const s = String(name == null ? "" : name).trim();
  if (!s) return null;
  // ön/arka farklıysa ("Medium/Wet") ilk parçayı sınıflandır (crossover nadir)
  const head = s.split(/[/,]/)[0].trim();
  for (const [rx, id] of RULES) if (rx.test(head)) return id;
  // tek-harf kod ("S","M","H","W") — yalnız tam eşleşme (yanlış pozitif olmasın)
  const one = head.toLowerCase();
  if (one.length === 1 && SHORT[one]) return SHORT[one];
  return null;
}

/* UI için tam bilgi: {cls, short, label, color, raw, crossover}. Eşleşmezse cls=null
   ama raw korunur (UI ham kısaltmayı gösterir). Veri hiç yoksa null döner. */
export function compoundInfo(name) {
  const raw = String(name == null ? "" : name).trim();
  if (!raw) return null;
  const cls = compoundClass(raw);
  const parts = raw.split(/[/,]/).map((x) => x.trim()).filter(Boolean);
  const crossover = parts.length > 1 && new Set(parts.map(compoundClass)).size > 1;
  if (!cls) {
    // bilinmeyen ad — ham metnin ilk 3 harfi kısaltma, sınıf yok
    return { cls: null, short: raw.slice(0, 3), label: raw, color: "var(--dim)",
      raw, crossover };
  }
  return { ...COMPOUNDS[cls], cls, raw, crossover };
}
