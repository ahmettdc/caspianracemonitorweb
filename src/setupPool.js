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
  } else if (key === "uploader") {
    list.sort((a, b) => String(a?.uname || "").localeCompare(String(b?.uname || ""), "tr", { sensitivity: "base" }) * mul);
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

/* base64 gövdenin SHA-256 hex'i — mükerrer yükleme kontrolü (v1.4.93). WebCrypto
   ister (tarayıcı/Node); yoksa ya da bozuk girdide boş döner → dedupe sessizce
   devre dışı kalır (yükleme engellenmez — dürüst düşüş). */
export async function b64Sha256Hex(b64) {
  try {
    const bin = atob(String(b64 || ""));
    if (!bin) return "";
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const buf = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
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

/* ============================================================
   DOSYA ADI STANDARDI (v2.2.4)
   ------------------------------------------------------------
   Havuza yüklenen .svm'ler kullanıcının ham dosya adıyla (`setup_1.svm`,
   `Spa deneme (2).svm`…) saklanıyordu → havuz okunaksız, arama işe yaramaz,
   indirilen dosya tanınmaz. Ad artık META'DAN türetilir:

       <pist>_<sınıf>-<araç>_<seans>-<koşul>_v<sürüm>.svm
       spa_gt3-ferrari_r-dry_v3.svm

   Sınıf neden var: araç id'leri sınıflar arası TEKİL DEĞİL — `ferrari` hem
   Hypercar 499P hem GT3 296. Sınıfsız iki farklı araç aynı adı alırdı.

   NEDEN OKURKEN TÜRETİLİYOR (yazılmıyor): `globalSetups` kuralı mevcut kaydın
   GÜNCELLENMESİNE izin vermiyor — yalnız oluşturma, ve silme (admin). Kayıtlar
   bilinçli olarak değiştirilemez. Bu yüzden eski kayıtları yeniden adlandırmak
   imkânsız; bunun yerine ad her okumada meta'dan üretilir → eski/yeni tüm
   kayıtlar anında standart görünür, tek bir yazma bile gerekmez. Ham ad
   `origName` olarak korunur (mükerrer uyarısı ve "aslı neydi" için).
   ============================================================ */

/* Türkçe/aksanlı harfleri ASCII'ye katla + dosya-adı güvenli parçaya çevir.
   `ı` NFD ile ayrışmadığı için ayrıca eşlenir (ğ/ş/ç/ö/ü ayrışıp aksanı düşer). */
function slugPart(v) {
  return String(v ?? "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* Sürüm alanı: nokta KORUNUR ("V1.2" → "v1.2"); baştaki v/V yinelenmesin. */
function verPart(v) {
  const s = String(v ?? "").toLowerCase().replace(/[^a-z0-9.]+/g, "")
    .replace(/^v+/, "").replace(/^\.+|\.+$/g, "");
  return s ? `v${s}` : "";
}

/* Adı olmayan/meta'sı zayıf kayıt için son çare: ham adı koru, uzantıyı garanti et. */
function fallbackName(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "setup.svm";
  return /\.svm$/i.test(s) ? s : `${s}.svm`;
}

/* meta → standart dosya adı. Pist yoksa "" (çağıran ham ada düşer).
   Boş alanlar segmentiyle birlikte düşer → "__" gibi boşluk oluşmaz. */
export function setupFileName(meta) {
  const m = meta || {};
  const track = slugPart(m.track);
  if (!track) return "";
  const carPart = [slugPart(m.cls), slugPart(m.car)].filter(Boolean).join("-");
  const sess = m.sess === "Q" ? "q" : m.sess === "R" ? "r" : "";
  const cond = m.cond === "wet" ? "wet" : m.cond === "dry" ? "dry" : "";
  const sc = [sess, cond].filter(Boolean).join("-");
  const base = [track, carPart, sc, verPart(m.ver)].filter(Boolean).join("_");
  return `${base.slice(0, 72)}.svm`;
}

/* Havuz satırlarına standart ad uygula (okuma yolu — tek enjeksiyon noktası;
   arama/süzme/sıralama/indirme hepsi bunun çıktısını kullanır).
   Aynı adı üreten kayıtlara id'nin son 4 hanesi eklenir — kişi alanı adda
   olmadığı için iki pilotun aynı meta'sı çakışabilir. Ek, GRUBUN TAMAMINA
   verilir → sıralama değişse de ad sabit kalır. */
export function withFileNames(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const derived = list.map((r) => ({ r, fn: setupFileName(r) }));
  const seen = {};
  for (const d of derived) if (d.fn) seen[d.fn] = (seen[d.fn] || 0) + 1;
  return derived.map(({ r, fn }) => ({
    ...r,
    origName: r?.name ?? "",
    name: !fn ? fallbackName(r?.name)
      : seen[fn] > 1 ? fn.replace(/\.svm$/, `-${String(r?.id ?? "").slice(-4)}.svm`)
        : fn,
  }));
}
