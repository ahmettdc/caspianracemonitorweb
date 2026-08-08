/* Canlı timing satır flash tespiti — klasik yarış (timing-tower) renk konvansiyonu:
   - MOR  : araç kendi SINIFINDA en hızlı turu attı (yeni sınıf rekoru).
   - YEŞİL: araç kendi turunu geliştirdi (kişisel rekor) ama sınıf en hızlısı değil.
   Saf + test edilebilir (engine.js/liveLaps.js deseni). detectFlashes bir kareyi
   (field dizisi) + önceki bestSec haritasını alır, {flashes, nextBest} döner.
   Sürüm/bellek: nextBest araç sayısıyla sınırlı (~saha büyüklüğü). */
import { classId } from "./constants";

/* Araç için KARARLI anahtar: sürücü adı endurance'ta pilot değişiminde değişir →
   lapKey (araç kimliği) tercih edilir; yoksa carId; en son sürücü adı yedeği. */
export function carKey(c) {
  if (!c) return null;
  return c.lapKey || (c.carId != null ? "c" + c.carId : null) || c.driver || null;
}

/* cars: live.field · prevBest: {aracKey: sonBestSec} (ref'te tutulur)
   → { flashes: {aracKey: "purple"|"green"}, nextBest: {aracKey: bestSec} }.
   İlk görüşte (prev yok) flash ÜRETİLMEZ (yüklemede hepsi yanmasın); yalnız kişisel
   rekorun İYİLEŞTİĞİ (bestSec düştüğü) kare flash üretir. */
export function detectFlashes(cars, prevBest, eps = 0.001) {
  const list = Array.isArray(cars) ? cars : [];
  const prev = prevBest || {};
  // güncel karede sınıf başına en iyi bestSec (mor = sınıf rekoru kararı için)
  const classBest = {};
  for (const c of list) {
    if (c && c.bestSec > 0) {
      const cid = classId(c.carClass);
      classBest[cid] = classBest[cid] == null ? c.bestSec : Math.min(classBest[cid], c.bestSec);
    }
  }
  const flashes = {};
  const nextBest = { ...prev };
  for (const c of list) {
    const key = carKey(c);
    if (!key) continue;
    const cur = c.bestSec;
    if (!(cur > 0)) continue;                 // geçersiz/eksik tur → dokunma
    const before = prev[key];
    if (before != null && cur < before - eps) {   // kişisel rekor İYİLEŞTİ
      const cid = classId(c.carClass);
      const isClassFastest = cur <= (classBest[cid] ?? cur) + eps;
      flashes[key] = isClassFastest ? "purple" : "green";
    }
    nextBest[key] = cur;                        // ilk görüşte de kaydet (flash yok)
  }
  return { flashes, nextBest };
}
