/* ============================================================
   setupPool — setup havuzunun saf (React'siz) mantığı
   ------------------------------------------------------------
   useSetups.js / App.jsx / components.jsx içinde satır arasına gömülü olan
   süzgeç, boş-durum ve kırpma kuralları buraya alındı → birim test edilebilir.
   Desen: engine.js / liveLaps.js / tyreCompound.js (saf modül + vitest).
   ============================================================ */

/* Ham dosya sınırı. Base64'e çevrilince ~%33 büyür (180 KB → ~240 KB);
   Firebase kuralı `data` için < 260000 karakter istiyor → sınır buna göre. */
export const SETUP_MAX_BYTES = 180 * 1024;

export const fileTooBig = (size) => Number(size) > SETUP_MAX_BYTES;

/* Meta alan uzunlukları — form maxLength'leri ile kaydetme kırpması AYNI
   sözleşmeden beslensin diye tek yerde (eskiden yalnız kaydederken kırpılıyor,
   kullanıcı sessizce veri kaybediyordu). */
export const SETUP_LIMITS = { champ: 40, ver: 16, note: 140 };

const cut = (v, n) => String(v ?? "").trim().slice(0, n);

/* Kaydetmeden önce serbest metin alanlarını kırp (diğer alanlar dokunulmaz). */
export function trimSetupMeta(meta) {
  return {
    ...meta,
    champ: cut(meta?.champ, SETUP_LIMITS.champ),
    ver: cut(meta?.ver, SETUP_LIMITS.ver),
    note: cut(meta?.note, SETUP_LIMITS.note),
  };
}

/* Liste süzgeci — boş süzgeç "hepsi" demek. */
export function filterSetups(setups, { track, cond, sess } = {}) {
  const list = Array.isArray(setups) ? setups : [];
  return list.filter((x) =>
    (!track || x.track === track)
    && (!cond || x.cond === cond)
    && (!sess || x.sess === sess));
}

/* Boş liste NEDEN boş? "none" = havuz gerçekten boş · "filtered" = süzgeç eledi ·
   null = liste dolu. Setup sekmesi eskiden her iki durumda da "Henüz setup yok"
   diyordu; havuzda kayıt varken bu yanıltıcıydı (süzgeç fark edilmiyordu). */
export function poolEmptyReason(total, shown) {
  if (shown > 0) return null;
  return total > 0 ? "filtered" : "none";
}

/* Pist süzgeci yalnız havuzda karşılığı OLAN pistleri listeler; seçili pistin son
   setup'ı silinirse option kaybolur ama süzgeç değeri kalır → select boş görünür,
   liste boş kalır ve sebebi görünmez ("hayalet süzgeç"). Bunu tespit eder. */
export function staleTrackFilter(setups, track) {
  if (!track) return false;
  const list = Array.isArray(setups) ? setups : [];
  return !list.some((x) => x.track === track);
}
