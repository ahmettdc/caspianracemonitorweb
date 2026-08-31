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
export function packBins(bins) {
  if (!bins || typeof bins !== "object") return "";
  const parts = [];
  for (const b of Object.keys(bins).map(Number).sort((a, z) => a - z)) {
    const p = bins[b];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) continue;
    parts.push(`${b}:${p.x.toFixed(0)},${p.z.toFixed(0)}`);
  }
  const s = parts.join(";");
  return s.length <= MAX_STR ? s : s.slice(0, s.lastIndexOf(";", MAX_STR));
}

/* string → bins {b:{x,z}} (bozuk/eksik parçalar atlanır; string değilse {}). */
export function unpackBins(str) {
  if (typeof str !== "string" || !str) return {};
  const out = {};
  for (const seg of str.split(";")) {
    const c = seg.indexOf(":");
    if (c < 0) continue;
    const b = Number(seg.slice(0, c));
    const xz = seg.slice(c + 1).split(",");
    const x = Number(xz[0]), z = Number(xz[1]);
    if (Number.isInteger(b) && b >= 0 && Number.isFinite(x) && Number.isFinite(z))
      out[b] = { x, z };
  }
  return out;
}
