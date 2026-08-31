/* ============================================================
   PAYLAŞIMLI İÇ-HARİTA ŞEKLİ — saf yardımcılar (React/Firebase bağımsız)
   TrackMap iç pist şeklini lapDist kutularında biriktirir (bin → dünya {x,z}).
   Bu şekil pist başına SABİTTİR → bir kez oluşunca Firebase'de saklanıp takımca
   paylaşılır (teams/{tid}/livetrack/{trackKey}). Burada yalnız anahtar + paketleme.
   Desen: liveWriter.js / posData.js (saf + trackShape.test.js doğrudan test eder).
   ============================================================ */

/* Firebase-güvenli pist anahtarı. Şekil PİST başına saklanır (yarış/rid değil) →
   aynı pistin tüm yarışlarında yeniden kullanılır. Ad varsa ondan (RTDB'de yasak
   .#$/[] → _), yoksa yuvarlanmış uzunluktan (L{metre}). İkisi de yoksa "" (paylaşım
   kapalı → yalnız bellek-içi). */
export function binKey(trackName, trackLength) {
  const nm = String(trackName ?? "").trim();
  if (nm) return nm.replace(/[.#$/[\]]/g, "_").slice(0, 120);
  const len = Math.round(Number(trackLength) || 0);
  return len > 0 ? `L${len}` : "";
}

const MAX_STR = 8800;   // Firebase yaprağı sınırı (kural .validate < 9000 ile uyumlu)

/* bins {b:{x,z}} → tek string "b:x,z;b:x,z;…" (koordinatlar TAM METRE, sınır korunur).
   Sıralı (b artan) → deterministik.

   NEDEN ONDALIK YOK (v2.3.0): kutu sayısı 240→480'e çıkınca 1 ondalıkla en kötü
   durum (±10000 m'lik Nordschleife ölçeği, negatif koordinatlar) 9490 karaktere
   çıkıyor ve MAX_STR'yi aşıp KIRPILIYORDU — paylaşılan şeklin kuyruğu düşerdi.
   Tam metreyle 480 kutu 7570 karakter (ölçüldü). Hassasiyet kaybı yok sayılır:
   harita ~300 px'lik kutuya normalize çiziliyor, 4 km pistte 1 px ≈ 13 m — yani
   1 m, bir pikselden ~13 kat ince.
   GERİYE UYUM: unpackBins Number() ile ayrıştırdığı için eski ondalıklı stringler
   aynen okunmaya devam eder; yalnız yeni yazımlar kısalır. */
/* v2.2.4 ve öncesinin kutu sayısı. O sürümlerde başlık yazılmıyordu; başlıksız bir
   kayıt gördüğümüzde çözünürlüğün BU olduğunu biliyoruz. */
export const LEGACY_NB = 240;

/* Kutu indeksini kaynak çözünürlükten hedef çözünürlüğe taşı (kutu ORTASI baz). */
const rescale = (idx, from, to) => Math.min(to - 1, Math.floor(((idx + 0.5) / from) * to));

export function packBins(bins, nb) {
  if (!bins || typeof bins !== "object") return "";
  const parts = [];
  for (const b of Object.keys(bins).map(Number).sort((a, z) => a - z)) {
    const p = bins[b];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) continue;
    parts.push(`${b}:${p.x.toFixed(0)},${p.z.toFixed(0)}`);
  }
  /* ÇÖZÜNÜRLÜK BAŞLIĞI (v2.3.0). Kutu indeksinin anlamı NB'ye bağlıdır: index 120,
     240 kutuda yarım tur, 480 kutuda çeyrek tur demektir. Başlık olmadan farklı
     sürümdeki takım arkadaşının kaydı SESSİZCE yanlış okunur — v2.2.4 verisi
     v2.3.0'da turun tamamını ilk yarıya sıkıştırıyor ve bozuk şekil "yeterince
     dolu" sayılıp hemen çiziliyordu. Başlıklı kayıtlar yeniden ölçeklenerek
     kurtarılır (atılmaz — takımın emeği korunur). */
  const head = Number(nb) > 0 ? `n${Math.round(nb)};` : "";
  const s = head + parts.join(";");
  return s.length <= MAX_STR ? s : s.slice(0, s.lastIndexOf(";", MAX_STR));
}

/* string → bins {b:{x,z}} (bozuk/eksik parçalar atlanır; string değilse {}).
   `nb` verilirse indeksler o çözünürlüğe TAŞINIR: kayıt başlığı (`n480;`) kaynak
   çözünürlüğü söyler, başlık yoksa v2.2.4 ve öncesi (LEGACY_NB=240) varsayılır.
   `nb` verilmezse indeksler olduğu gibi döner (eski çağrı biçimi korunur). */
export function unpackBins(str, nb) {
  if (typeof str !== "string" || !str) return {};
  let body = str;
  let src = LEGACY_NB;
  const m = /^n(\d+);/.exec(str);
  if (m) { src = Number(m[1]); body = str.slice(m[0].length); }
  const to = Number(nb) > 0 ? Math.round(nb) : 0;
  const move = to > 0 && src > 0 && src !== to;
  const out = {};
  for (const seg of body.split(";")) {
    const c = seg.indexOf(":");
    if (c < 0) continue;
    const b = Number(seg.slice(0, c));
    const xz = seg.slice(c + 1).split(",");
    const x = Number(xz[0]), z = Number(xz[1]);
    if (Number.isInteger(b) && b >= 0 && Number.isFinite(x) && Number.isFinite(z))
      out[move ? rescale(b, src, to) : b] = { x, z };
  }
  return out;
}
