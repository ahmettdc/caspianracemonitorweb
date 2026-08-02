/* ============================================================
   setupPool — setup havuzunun saf (React'siz) mantığı
   ------------------------------------------------------------
   useSetups.js / App.jsx / components.jsx içinde satır arasına gömülü olan
   süzgeç, boş-durum ve kırpma kuralları buraya alındı → birim test edilebilir.
   Desen: engine.js / liveLaps.js / tyreCompound.js (saf modül + vitest).
   ============================================================ */
import { parseLap } from "./engine";

/* Ham dosya sınırı. Base64'e çevrilince ~%33 büyür (180 KB → ~240 KB);
   Firebase kuralı `data` için < 260000 karakter istiyor → sınır buna göre. */
export const SETUP_MAX_BYTES = 180 * 1024;

export const fileTooBig = (size) => Number(size) > SETUP_MAX_BYTES;

/* Meta alan uzunlukları — form maxLength'leri ile kaydetme kırpması AYNI
   sözleşmeden beslensin diye tek yerde (eskiden yalnız kaydederken kırpılıyor,
   kullanıcı sessizce veri kaybediyordu). */
export const SETUP_LIMITS = { champ: 40, ver: 16, note: 140, lap: 12 };

const cut = (v, n) => String(v ?? "").trim().slice(0, n);

/* Kaydetmeden önce serbest metin alanlarını kırp (diğer alanlar dokunulmaz). */
export function trimSetupMeta(meta) {
  return {
    ...meta,
    champ: cut(meta?.champ, SETUP_LIMITS.champ),
    ver: cut(meta?.ver, SETUP_LIMITS.ver),
    note: cut(meta?.note, SETUP_LIMITS.note),
    lap: cut(meta?.lap, SETUP_LIMITS.lap),
  };
}

/* Serbest metin arama — dosya adı / not / şampiyona / yükleyen / takım üzerinde
   küçük-harf substring. Boş sorgu = hepsi. */
export function searchSetups(rows, q) {
  const list = Array.isArray(rows) ? rows : [];
  const s = String(q || "").trim().toLowerCase();
  if (!s) return list;
  return list.filter((r) =>
    [r?.name, r?.note, r?.champ, r?.uname, r?.team]
      .some((v) => String(v || "").toLowerCase().includes(s)));
}

/* Sıralama — key: "date" | "lap". Lap'te geçersiz/boş süreler HER YÖNDE sonda
   (en hızlı = asc). Varsayılan date-desc, watchSetups'ın bugünkü sırasıyla aynı. */
export function sortSetups(rows, key = "date", dir = "desc") {
  const list = [...(Array.isArray(rows) ? rows : [])];
  const mul = dir === "asc" ? 1 : -1;
  if (key === "lap") {
    list.sort((a, b) => {
      const la = parseLap(a?.lap), lb = parseLap(b?.lap);
      const va = la > 0 ? la : null, vb = lb > 0 ? lb : null;
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (va - vb) * mul;
    });
  } else {
    list.sort((a, b) => ((a?.at || 0) - (b?.at || 0)) * mul);
  }
  return list;
}

/* Pist+sınıf grubunda tur zamanı olan HER satır için { fastest, delta } — delta:
   grubun en hızlısına fark (sn; en hızlıda 0). Geçersiz/boş lap → map'te yok.
   Tabloda/kartlarda ⚡ vurgusu ve "+0.6s" ekleri buradan beslenir. */
export function lapDeltas(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const groups = {};   // "track|cls" → [{id, sec}]
  for (const r of list) {
    const sec = parseLap(r?.lap);
    if (!(sec > 0)) continue;
    (groups[`${r.track || ""}|${r.cls || ""}`] ||= []).push({ id: r.id, sec });
  }
  const out = new Map();
  for (const k of Object.keys(groups)) {
    const min = Math.min(...groups[k].map((x) => x.sec));
    for (const x of groups[k]) {
      out.set(x.id, { fastest: x.sec - min <= 1e-6, delta: x.sec - min });
    }
  }
  return out;
}

/* Gösterilen satırlar arasında EN HIZLI setup id'leri — pist+sınıf grubunda en düşük
   tur zamanı. Beraberlikte hepsi. lapDeltas üstüne kurulu (tek kaynak). */
export function fastestSetupIds(rows) {
  const out = new Set();
  for (const [id, v] of lapDeltas(rows)) if (v.fastest) out.add(id);
  return out;
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
