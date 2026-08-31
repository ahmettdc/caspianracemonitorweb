/* ============================================================
   RELATIVE (YAKIN SAHA) — saf (v2.3.0)
   ------------------------------------------------------------
   Standings tablosu YARIŞ SIRASINI gösterir; pit duvarının asıl sorusu ise
   "şu an etrafımda kim var" olur. Tur-altı bir araç sıralamada 15 satır aşağıda
   durur ama pistte tam önümüzdedir — trafik, undercut penceresi ve mavi bayrak
   kararları sıralamadan DEĞİL, PİST KONUMUNDAN okunur.

   Hesap: iki aracın tur içi mesafe farkı (lapDist, metre) yarım tur etrafında
   sarmalanır → en kısa yoldaki fark. Bu fark referans tur süresiyle saniyeye
   çevrilir.

   İşaret konvansiyonu TinyPedal ile aynı:
     NEGATİF (−) = rakip pistte ÖNÜMÜZDE
     POZİTİF (+) = rakip pistte ARKAMIZDA

   DOĞRULUK SINIRI (bilinçli): bu bir MESAFE→ZAMAN çevrimidir, gerçek delta
   değil. Farklı hızdaki (farklı sınıf) araçlarda ve pit yolundakilerde yalnız
   yaklaşıktır; oyun bu veriyi vermediği için tek yol budur. Pit'teki araçlar
   listeden çıkarılır — pist boşluğunu yanlış gösterirler.

   React/Firebase bağımsız → liveRelative.test.js doğrudan test eder.
   ============================================================ */

/* İki aracın tur içi mesafe farkı, yarım tur etrafında sarmalanmış (metre).
   Pozitif = other pistte ileride. L geçersizse null. */
export function wrapDist(meDist, otherDist, L) {
  /* DİKKAT: Number(null) === 0 ve Number("") === 0 — açık kontrol olmadan
     `lapDist`i EKSİK bir araç "S/F çizgisinde" sayılır ve makul GÖRÜNEN ama
     tamamen uydurma bir relative farkı üretir. Eksik veri elenmeli. */
  const num = (v) => (v == null || v === "" ? Number.NaN : Number(v));
  const len = num(L);
  const a = num(meDist);
  const b = num(otherDist);
  if (!(len > 0) || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  let d = b - a;
  const half = len / 2;
  while (d > half) d -= len;
  while (d < -half) d += len;
  return d;
}

/* Sarmalanmış mesafe → saniye. refLapSec: referans tur süresi (bizim tempomuz).
   Dönüş: NEGATİF = rakip önümüzde, POZİTİF = arkamızda (TinyPedal konvansiyonu). */
export function relGapSec(meDist, otherDist, L, refLapSec) {
  const d = wrapDist(meDist, otherDist, L);
  const lap = Number(refLapSec);
  if (d == null || !(lap > 0)) return null;
  return -(d / Number(L)) * lap;   // wrapDist null döndüyse L'nin geçerliliği kanıtlı
}

/* Referans tur süresi: kendi AVG5'imiz → son tur → en iyi tur. Hiçbiri yoksa null
   (o zaman relative saniyeye çevrilemez, yalnız sıra kurulur). */
export function refLap(me) {
  if (!me) return null;
  for (const v of [me.avg5Sec, me.avgSec, me.lastSec, me.bestSec]) {
    if (Number(v) > 0) return Number(v);
  }
  return null;
}

/* Oyuncunun etrafındaki araçlar — pistte önde `ahead`, arkada `behind` kadar.
   rows: LiveTab türetilmiş satırları ({c, ...}) · me: oyuncunun field satırı.
   Dönüş: [{ r, relSec, dist }] — pistte önden arkaya sıralı, oyuncu satırı dahil.
   Pit/garajdaki araçlar (oyuncunun kendisi hariç) elenir. */
export function relativeRows(rows, me, trackLength, ahead = 3, behind = 3) {
  const list = Array.isArray(rows) ? rows : [];
  if (!me || !(Number(trackLength) > 0)) return [];
  const ref = refLap(me);
  const scored = [];
  for (const r of list) {
    const c = r.c;
    const isMe = c === me || (c.carId != null && c.carId === me.carId);
    if (!isMe && (c.inPits || c.location === "GARAGE")) continue;
    const dist = isMe ? 0 : wrapDist(me.lapDist, c.lapDist, trackLength);
    if (dist == null) continue;
    scored.push({ r, dist, relSec: isMe ? 0 : relGapSec(me.lapDist, c.lapDist, trackLength, ref), isMe });
  }
  // pistte ÖNDEN arkaya: dist büyük (ileride) → küçük (geride)
  scored.sort((a, b) => b.dist - a.dist);
  const k = scored.findIndex((x) => x.isMe);
  if (k < 0) return [];
  return scored.slice(Math.max(0, k - ahead), k + behind + 1);
}
