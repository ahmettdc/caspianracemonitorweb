/* ============================================================
   RELATIVE (YAKIN SAHA) — saf (v2.3.0)
   ------------------------------------------------------------
   Standings tablosu YARIŞ SIRASINI gösterir; pit duvarının asıl sorusu ise
   "şu an etrafımda kim var" olur. Tur-altı bir araç sıralamada 15 satır aşağıda
   durur ama pistte tam önümüzdedir — trafik, undercut penceresi ve mavi bayrak
   kararları sıralamadan DEĞİL, PİST KONUMUNDAN okunur.

   ---- YÖNTEM: neden mesafe DEĞİL, ZAMAN ----
   İlk uygulamada fark tur içi MESAFEDEN türetiliyordu:
       (otherDist − meDist) / trackLength × turSüresi
   Bu, aracın tur boyunca SABİT HIZDA gittiğini varsayar. Gerçekte 500 m düzlükte
   ~6 sn, 500 m şikan kompleksinde ~20 sn eder → hata en çok, relative'in en çok
   gerektiği yerde (yavaş virajlar, trafik) büyür.

   TinyPedal kaynağı incelendi (`tinypedal/module/module_relative.py`,
   `get_vehicles_info`): farkı MESAFEDEN HİÇ hesaplamıyor, oyunun kendi
   alanlarını okuyor —
       diff = opponent.mTimeIntoLap − player.mTimeIntoLap
       (mEstimatedLapTime modülünde sarmalanır)
   rF2 struct'ının kendi notu da bu eşleşmeyi söylüyor: mEstimatedLapTime =
   "estimated laptime used for 'time behind' and 'time into lap'".
   Biz de artık birincil yol olarak bunu kullanıyoruz.

   MESAFE YOLU YEDEK OLARAK KALIYOR: köprü .exe kullanıcı tarafından ayrı
   güncelleniyor; sahadaki eski sürümler `timeIntoLap`/`estLapTime` göndermez.
   O durumda eski (yaklaşık) hesap devreye girer, özellik kaybolmaz.

   ---- İŞARET ----
   TinyPedal ile aynı (widget/relative.py: metni `-data[0]` ile yazar):
     NEGATİF (−) = rakip pistte ÖNÜMÜZDE
     POZİTİF (+) = rakip pistte ARKAMIZDA

   Pit'teki araçlar listeden çıkarılır — pist boşluğunu yanlış gösterirler.

   React/Firebase bağımsız → liveRelative.test.js doğrudan test eder.
   ============================================================ */

/* Eksik sayı kontrolü: Number(null)===0 ve Number("")===0 olduğu için açık
   kontrol şart — `timeIntoLap` 0 GEÇERLİ bir değerdir (S/F'yi yeni geçmiş araç),
   "yok" ile karıştırılamaz. */
const num = (v) => (v == null || v === "" ? Number.NaN : Number(v));

/* İki aracın tur içi mesafe farkı, yarım tur etrafında sarmalanmış (metre).
   Pozitif = other pistte ileride. L geçersizse null. */
export function wrapDist(meDist, otherDist, L) {
  /* DİKKAT: Number(null) === 0 ve Number("") === 0 — açık kontrol olmadan
     `lapDist`i EKSİK bir araç "S/F çizgisinde" sayılır ve makul GÖRÜNEN ama
     tamamen uydurma bir relative farkı üretir. Eksik veri elenmeli. */
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

/* ZAMAN ALANI yolu (birincil) — TinyPedal'ın formülü.
   meT/otherT: mTimeIntoLap · estLap: oyuncunun mEstimatedLapTime'ı.
   Dönüş: NEGATİF = rakip önümüzde, POZİTİF = arkamızda. Geçersizse null.

   TinyPedal iki ayrı liste tutar (ahead: [0,L), behind: [−L,0)); bizde tek
   ±pencere olduğu için KISA YOL seçilir (yarım tur eşiği) — aynı araç için iki
   listede aynı sayının iki gösterimi olduğundan bu bir sapma değil, seçimdir. */
export function wrapTime(meT, otherT, estLap) {
  const a = num(meT);
  const b = num(otherT);
  const L = num(estLap);
  /* Köprü veri yokken -1 nöbetçisi gönderir (oyunun kendi "geçersiz" değeri).
     0 GEÇERLİDİR (S/F'yi yeni geçen araç) → eşik `< 0`, `<= 0` DEĞİL. */
  if (!(a >= 0) || !(b >= 0) || !(L > 0)) return null;
  let d = b - a;
  d -= Math.floor(d / L) * L;      // → [0, L)  (TinyPedal ile aynı floor-mod)
  if (d > L / 2) d -= L;           // kısa yol: > yarım tur ise arkadan ölç
  return -d;                       // − önde, + arkada
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
  if (!me) return [];
  /* Oyunun zaman alanları varsa pist uzunluğu HİÇ gerekmez; yoksa mesafe yedeğine
     düşeriz ve orada trackLength şart. */
  const estLap = num(me.estLapTime);
  const timeOk = num(me.timeIntoLap) >= 0 && estLap > 0;   // -1 = veri yok
  if (!timeOk && !(Number(trackLength) > 0)) return [];
  const ref = refLap(me);
  const scored = [];
  for (const r of list) {
    const c = r.c;
    const isMe = c === me || (c.carId != null && c.carId === me.carId);
    if (!isMe && (c.inPits || c.location === "GARAGE")) continue;
    if (isMe) { scored.push({ r, dist: 0, relSec: 0, isMe: true }); continue; }
    /* BİRİNCİL: oyunun kendi tur-içi zamanı (TinyPedal yöntemi). Bu araç alanı
       göndermiyorsa (eski köprü / geçersiz kare) mesafe yedeğine düşülür —
       satır kaybolmasın, yalnız o satır yaklaşık olsun. */
    const relT = timeOk ? wrapTime(me.timeIntoLap, c.timeIntoLap, estLap) : null;
    const dist = wrapDist(me.lapDist, c.lapDist, trackLength);
    if (relT == null && dist == null) continue;
    scored.push({
      r,
      /* Sıralama anahtarı: zaman varsa ondan (− önde olduğu için işareti çevir),
         yoksa mesafeden. İkisi de tur boyunca monotondur → aynı sırayı verir. */
      dist: relT != null ? -relT : dist,
      relSec: relT != null ? relT : relGapSec(me.lapDist, c.lapDist, trackLength, ref),
      isMe: false,
    });
  }
  // pistte ÖNDEN arkaya: dist büyük (ileride) → küçük (geride)
  scored.sort((a, b) => b.dist - a.dist);
  const k = scored.findIndex((x) => x.isMe);
  if (k < 0) return [];
  return scored.slice(Math.max(0, k - ahead), k + behind + 1);
}
