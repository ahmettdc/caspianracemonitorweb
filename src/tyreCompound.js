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

/* TEK hamur adının UI bilgisi: {cls, short, label, color, raw}. Eşleşmezse cls=null
   ama raw korunur (UI ham kısaltmayı gösterir). Veri hiç yoksa null döner.
   (Ön/arka birleşiminin ayrıştırılması compoundAxles'ta — burası tek ad işler.) */
export function compoundInfo(name) {
  const raw = String(name == null ? "" : name).trim();
  if (!raw) return null;
  const cls = compoundClass(raw);
  if (!cls) {
    // bilinmeyen ad — ham metnin ilk 3 harfi kısaltma, sınıf yok
    return { cls: null, short: raw.slice(0, 3), label: raw, color: "var(--dim)", raw };
  }
  return { ...COMPOUNDS[cls], cls, raw };
}

/* Köprü ön≠arka iken `tyreComp = "Ön/Arka"` gönderir (rf2_source._compound, f"{f}/{r}");
   aynıysa tek ad. Bunu ön/arka ikonlarına ayır. Paylaşımlı bellek yalnız ön+arka verir
   (teker başına hamur YOK) → sol/sağ ayrımı rakiplerde yapılamaz; bu yüzden ekseni
   ön/arka kabul ederiz. Döner: { front, rear, split } — front daima (varsa), rear yalnız
   FARKLIYSA doludur, split o zaman true. Veri yoksa null. */
export function compoundAxles(tyreComp) {
  const raw = String(tyreComp == null ? "" : tyreComp).trim();
  if (!raw) return null;
  const parts = raw.split(/[/,]/).map((x) => x.trim()).filter(Boolean);
  const front = compoundInfo(parts[0] ?? raw);
  if (!front) return null;
  const rear = parts.length > 1 ? compoundInfo(parts[1]) : null;
  // ayrı kademe (ör. medium vs soft) ya da ham adlar farklı → gerçek crossover
  const split = !!rear && (rear.cls !== front.cls || rear.raw !== front.raw);
  return { front, rear: split ? rear : null, split };
}

/* Pit lastik değişimi kaydı: köprü/harvest `"{adet}|{hamur}"` yazar (livetyre düğümü,
   ör. "4|Medium", "2|Medium/Soft"). Tur geçmişi popup'ında "N× hamur ikonu" göstermek
   için ayrıştırılır. Bozuk/eksik → null. */
export function parseTyreLog(str) {
  const s = String(str == null ? "" : str);
  const bar = s.indexOf("|");
  if (bar < 0) return null;
  const n = Number(s.slice(0, bar).trim());
  if (!Number.isInteger(n) || n < 0 || n > 4) return null;
  const comp = s.slice(bar + 1).trim();
  return { n, comp: comp || null };
}
