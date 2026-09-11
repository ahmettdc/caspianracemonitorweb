/* ============================================================
   Güncelleme penceresinin "Öne çıkanlar" satırlarını üretir.

   NEDEN: satırlar CHANGELOG'un ilk maddelerinden geliyor ve o maddeler TAM
   PARAGRAF (v2.4.1'de 350/409/445 karakter). Pencereyi ölçülebilir şekilde
   uzatıyorlardı — Chromium'da gerçek metinle ölçüldü (v2.4.3):

     kart genişliği 452px · tam metin   → 789 px
     kart genişliği 452px · başlık      → 420 px   (-%47)
     kart genişliği 620px · tam metin   → 605 px   (-%23)
     kart genişliği 620px · başlık      → 367 px   (taban)

   Yani asıl kaldıraç genişlik değil METİN UZUNLUĞU. Maddeler zaten büyük harfle
   yazılmış bir başlık cümlesiyle açılıyor ("🗺️ SEKTÖR AYIRICILARI TAKIMA HİÇ
   ULAŞMIYORDU."), o yüzden ilk cümle tek başına anlamlı bir öne çıkan oluyor.

   Metin GİZLENMİYOR: kırpma olduğunda satır "…" ile biter ve tam metin bir tık
   ötede — pencerenin kendi "Tüm değişiklikler" bağlantısı. Kırpıldığını
   söylemeden kırpmak bu kod tabanında kabul edilmiyor (bkz. CLAUDE.md §1).
   ============================================================ */

/* Cümle sonu: . ! ? ; ARDINDAN boşluk. Boşluk şartı bilerek — "v2.4.1'de" ya da
   "2.5 sn" gibi sayı içindeki noktayı cümle sonu saymasın. */
const SENT_END = /[.!?;]\s/u;

/* Bir changelog maddesini tek satırlık öne çıkana indirir.
   maxLen: cümle bulunamazsa (ya da cümle çok uzunsa) sözcük sınırından kırpar. */
export function headline(item, maxLen = 170) {
  const s = String(item ?? "").trim();
  if (!s) return "";

  const m = s.match(SENT_END);
  // +1: noktalama cümlede kalsın, ardındaki boşluk düşsün
  let out = m ? s.slice(0, m.index + 1) : s;
  let cut = out.length < s.length;

  if (out.length > maxLen) {
    const head = out.slice(0, maxLen);
    const sp = head.lastIndexOf(" ");
    out = (sp > maxLen * 0.6 ? head.slice(0, sp) : head).trim();
    cut = true;
  }

  /* Kırpma varsa bunu göster — okuyan "devamı var" olduğunu bilsin. */
  return cut ? `${out.replace(/[.!?;,\s]+$/u, "")}…` : out;
}

/* CHANGELOG'un bir sürüm kaydından pencereye girecek satırları üretir.
   Boş/eksik maddeler elenir; en fazla `count` satır döner. */
export function updateHighlights(items, count = 3, maxLen = 170) {
  return (Array.isArray(items) ? items : [])
    .map((x) => headline(x, maxLen))
    .filter(Boolean)
    .slice(0, count);
}
