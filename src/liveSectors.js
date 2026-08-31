/* ============================================================
   SEKTÖR RENKLENDİRME — klasik timing-tower konvansiyonu (v2.3.0)
   ------------------------------------------------------------
   Saha tablosundaki "Sektör" sütunu v2.2.4'e kadar düz griydi: S1·S2·S3 sayı
   olarak vardı ama hangisinin iyi olduğu görünmüyordu. Timing tower'ların en
   çok kullanılan sinyali budur.

   Renk semantiği liveFlash.js (satır flash'ı) ile BİREBİR AYNI tutuldu — aynı
   ekranda iki farklı "mor" anlamı olmasın:
     MOR   : bu sektör aracın SINIFINDA en hızlısı (sınıf rekoru)
     YEŞİL : aracın KİŞİSEL en iyi sektörü (ama sınıf en hızlısı değil)
     null  : ikisi de değil → normal renk

   Kaynak veri: köprü her araca `bestSectors: [b1,b2,b3]` gönderir (rF2
   mBestSector1/mBestSector2/mBestLapTime'dan türetilir — bkz. rf2_source.py
   _best_sectors). Sınıf en iyisi bu kişisel en iyilerin sahadaki minimumudur.

   Saf + React/Firebase bağımsız → liveSectors.test.js doğrudan test eder.
   ============================================================ */
import { classId } from "./constants";

/* Köprü sektörleri 3 ondalığa yuvarlar; kayan nokta karşılaştırmasında tolerans.
   liveFlash.detectFlashes ile aynı büyüklük. */
export const SEC_EPS = 0.001;

/* field → { sınıfId: [b1,b2,b3] } — sınıf başına en hızlı sektör süreleri.
   Her aracın KİŞİSEL en iyisinden (bestSectors) toplanır; eksik/geçersiz atlanır.
   Sahada o sektörü kimse geçerli atmadıysa ilgili eleman null kalır. */
export function classBestSectors(cars) {
  const out = {};
  for (const c of Array.isArray(cars) ? cars : []) {
    const bs = c && c.bestSectors;
    if (!Array.isArray(bs)) continue;
    const cid = classId(c.carClass);
    const row = out[cid] || (out[cid] = [null, null, null]);
    for (let i = 0; i < 3; i += 1) {
      const v = Number(bs[i]);
      if (!(v > 0)) continue;
      if (row[i] == null || v < row[i]) row[i] = v;
    }
  }
  return out;
}

/* Tek bir sektör süresi → "purple" | "green" | null.
   val: ekranda gösterilen süre · pb: aracın kişisel en iyisi · cb: sınıf en iyisi.
   Sıra ÖNEMLİ: sınıf rekoru kişisel rekoru kapsar (mor, yeşili ezer). */
export function sectorTone(val, pb, cb, eps = SEC_EPS) {
  const v = Number(val);
  if (!(v > 0)) return null;
  if (Number(cb) > 0 && v <= Number(cb) + eps) return "purple";
  if (Number(pb) > 0 && v <= Number(pb) + eps) return "green";
  return null;
}

/* Bir satırın gösterilen üç sektörü için renk dizisi.
   vals: [s1,s2,s3] (anlık curSectors ya da son turun lastSectors — hangisi
   çiziliyorsa o) · c: field satırı · classBest: classBestSectors() çıktısı. */
export function sectorTones(vals, c, classBest, eps = SEC_EPS) {
  const v = Array.isArray(vals) ? vals : [];
  const pb = Array.isArray(c && c.bestSectors) ? c.bestSectors : [];
  const cb = (classBest && classBest[classId(c && c.carClass)]) || [];
  return [0, 1, 2].map((i) => sectorTone(v[i], pb[i], cb[i], eps));
}

/* Renk tonu → CSS değişkeni. null → çağıran kendi varsayılanını kullanır. */
export const TONE_COLOR = { purple: "var(--purple)", green: "var(--green)" };
