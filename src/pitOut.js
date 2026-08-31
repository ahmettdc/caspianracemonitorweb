/* ============================================================
   PİT ÇIKIŞ TAHMİNİ — saf (v2.3.0)
   ------------------------------------------------------------
   "Duraǧım N saniye sürerse pistte KİMİN yanına çıkarım?" — pit duvarının
   undercut/overcut kararını verdiği soru. TinyPedal'da `widget/track_map.py`
   `draw_pitout_prediction` olarak var; algoritma oradan alındı.

   ---- MANTIK ----
   Her şey "tur içi zaman" ekseninde çalışır. Pit çıkışına vardığımız ana kadar
   geçecek süre:
       Δ = (pit girişine kalan süre) + (pit yolunda geçecek süre)
   Şu anda tur-içi zamanı `T` olan bir araç, Δ sonra `T + Δ` konumunda olur. Biz
   `t_exit` konumunda çıkacağımıza göre, yanına çıkacağımız araç ŞU AN şurada:
       T = t_exit − Δ = t_exit + pitTimer − pitSüresi          (tur boyunca sarmalı)
   `pitTimer` = (şimdiki tur-içi zaman) − (pit girişinin tur-içi zamanı); pit
   girişine varmadığımız için NEGATİFTİR ve tam olarak "girişe kalan süre"dir.

   ---- MESAFE ↔ ZAMAN EĞRİSİ ----
   Bu hesap için turun "hangi mesafede kaçıncı saniyedeyiz" eğrisi gerekir.
   TinyPedal bunu sürücünün EN İYİ TURUNDAN kaydediyor (deltabest). Bizde öyle bir
   kayıt yok — ama köprü artık her araç için `timeIntoLap` + `estLapTime`
   gönderiyor (v2.3.0), yani sahadaki HER ARAÇ eğriye bir örnek veriyor:
       zamanKesri = timeIntoLap / estLapTime   ↔   mesafeKesri = lapDist / trackLength
   Kutulara biriktirilir (harita kutularıyla aynı indeks) → eğri tempo-bağımsız
   (kesir olduğu için) ve tüm sahadan hızla dolar. Bu bizim için TinyPedal'ın
   yönteminden daha uygun: izleyicinin kendi turu yok.

   DOĞRULUK SINIRI (dürüstçe): eğri araçların GERÇEK turlarından gelir, temiz bir
   referans turdan değil — trafik/hata bulunan örnekler ortalamaya karışır. Kutu
   ortalaması bunu yumuşatır ama sıfırlamaz. Tahmin bir YÖN gösterir, saniye
   garantisi değil.

   React/Firebase bağımsız → pitOut.test.js doğrudan test eder.
   ============================================================ */

/* Otomatik aday durak süreleri (saniye): 15, 25, 35, 45, 55, 65.
   TinyPedal varsayılanıyla aynı seri (min 15 + artım 10 × 6 tahmin).
   ANLAMI: pit GİRİŞ çizgisinden pit ÇIKIŞ çizgisine kadar geçen TOPLAM süre —
   yani servis + pit yolu sürüşü. Ekranda da bu sayı yazar (gizli ofset yok). */
export const PIT_MIN = 15;
export const PIT_STEP = 10;
export const PIT_COUNT = 6;

export const emptyCurve = () => ({});

/* Bir aracın (kutu, zamanKesri) örneğini eğriye ekle. Kutu ortalaması tutulur.
   timeFrac 0..1 dışındaysa yok sayılır (bozuk kare). Durumu yerinde değiştirir
   (trackSectors.observeSector deseni) ve aynı nesneyi döner. */
export function observeCurve(state, bin, timeFrac) {
  const st = state || emptyCurve();
  const b = Number(bin);
  const f = Number(timeFrac);
  if (!Number.isInteger(b) || b < 0) return st;
  if (!Number.isFinite(f) || f < 0 || f > 1) return st;
  const cur = st[b] || (st[b] = { sum: 0, n: 0 });
  cur.sum += f;
  cur.n += 1;
  return st;
}

/* Aracın karesinden zaman kesri: timeIntoLap / estLapTime.
   `-1` köprünün "veri yok" nöbetçisi; `0` GEÇERLİDİR (S/F'yi yeni geçmiş araç). */
export function timeFracOf(c) {
  if (!c) return null;
  const t = c.timeIntoLap;
  const L = c.estLapTime;
  if (t == null || L == null) return null;
  const tn = Number(t);
  const Ln = Number(L);
  if (!(tn >= 0) || !(Ln > 0)) return null;
  const f = tn / Ln;
  return f >= 0 && f <= 1 ? f : null;
}

/* Biriktiriciden kullanılabilir eğri: { bin: zamanKesri }. Örneği olmayan kutu yok.
   Hiç kutu yoksa null (eğri kurulamadı → tahmin çizilmez). */
export function curveOf(state) {
  if (!state) return null;
  const out = {};
  let n = 0;
  for (const k of Object.keys(state)) {
    const c = state[k];
    if (c && c.n > 0) { out[k] = c.sum / c.n; n += 1; }
  }
  return n > 0 ? out : null;
}

/* Eğri ne kadar doldu (0..1) — UI "oluşturuluyor…" demek için kullanır. */
export function curveFill(curve, nb) {
  if (!curve || !(nb > 0)) return 0;
  return Object.keys(curve).length / nb;
}

/* mesafeKesri → zamanKesri. En yakın DOLU kutudan okunur (kutu ≈ 10 m, çember
   çizmek için fazlasıyla yeterli; ara değer hesabının kenar durumları yok). */
export function timeAtDist(curve, distFrac, nb) {
  if (!curve || !(nb > 0)) return null;
  const f = Number(distFrac);
  if (!Number.isFinite(f)) return null;
  const target = ((f % 1) + 1) % 1;
  const want = Math.floor(target * nb) % nb;
  for (let d = 0; d <= nb / 2; d += 1) {
    const a = curve[(want + d) % nb];
    if (a != null) return a;
    const b = curve[((want - d) % nb + nb) % nb];
    if (b != null) return b;
  }
  return null;
}

/* zamanKesri → mesafeKesri (ters arama). Eğri kabaca monoton ama gürültülü
   olabileceğinden ikili arama yerine tüm kutular taranıp EN YAKIN zaman seçilir
   (≤480 kutu → önemsiz). Yakınlık DAİRESELDİR: 0.99 ile 0.01 komşudur. */
export function distAtTime(curve, timeFrac, nb) {
  if (!curve || !(nb > 0)) return null;
  const f = Number(timeFrac);
  if (!Number.isFinite(f)) return null;
  const target = ((f % 1) + 1) % 1;
  let bestBin = null;
  let bestD = Infinity;
  for (const k of Object.keys(curve)) {
    const raw = Math.abs(curve[k] - target);
    const d = Math.min(raw, 1 - raw);      // dairesel mesafe
    if (d < bestD) { bestD = d; bestBin = Number(k); }
  }
  return bestBin == null ? null : (bestBin + 0.5) / nb;
}

/* Aday durak süreleri → pistte hangi mesafe kesrine denk geldikleri.
   entryFrac/exitFrac: gözlenmiş pit giriş/çıkış oranları · nowFrac: oyuncunun
   şu anki tur içi konumu · lapSec: tempo (AVG5 vb.).
   Dönüş: [{ sec, distFrac }] — veri eksikse boş dizi (uydurma yok). */
export function pitOutTargets({ curve, nb, entryFrac, exitFrac, nowFrac, lapSec,
  min = PIT_MIN, step = PIT_STEP, count = PIT_COUNT }) {
  if (!curve || !(nb > 0) || !(Number(lapSec) > 0)) return [];
  const tEntry = timeAtDist(curve, entryFrac, nb);
  const tExit = timeAtDist(curve, exitFrac, nb);
  const tNow = timeAtDist(curve, nowFrac, nb);
  if (tEntry == null || tExit == null || tNow == null) return [];
  const L = Number(lapSec);
  /* Girişe kalan süre. Henüz girişe varmadıysak negatif; girişi geçtiysek (talep
     hâlâ açıkken) pozitif olur ve hesap yine tutarlıdır. */
  const pitTimer = (tNow - tEntry) * L;
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const sec = min + step * i;
    let off = pitTimer + tExit * L - sec;
    off -= Math.floor(off / L) * L;            // → [0, L)
    const d = distAtTime(curve, off / L, nb);
    if (d != null) out.push({ sec, distFrac: d });
  }
  return out;
}

/* Ekranda çizilecek NOKTALAR — tüm koşul mantığı burada, JSX'te yalnız çizim kalsın
   (CLAUDE.md §2). Koşullardan biri bile tutmuyorsa BOŞ döner; "çizme" kararı da
   uydurmama kuralının parçası.

   Koşullar:
   - oyuncu sahada ve pit TALEBİ vermiş (mPitState == 1) — pite girdikten sonra
     karar değil seyir olurdu, o yüzden yalnız talep aşaması,
   - pit giriş VE çıkışı gözlenmiş (varsayılan oran yok),
   - tempo biliniyor, pist uzunluğu var,
   - mesafe→zaman eğrisi yeterince dolu (seyrek eğri yanıltıcı tahmin verir).

   Dönüş: [{ sec, distFrac, bin }] — bin doğrudan harita kutusu indeksidir. */
export const CURVE_MIN_FILL = 0.35;

export function pitOutPoints({ me, curve, nb, pitFr, trackLength, lapSec,
  minFill = CURVE_MIN_FILL, ...opt }) {
  if (!me || !pitFr || pitFr.entry == null || pitFr.exit == null) return [];
  if (!(Number(trackLength) > 0) || !(Number(lapSec) > 0)) return [];
  if (curveFill(curve, nb) < minFill) return [];
  const nowFrac = ((Number(me.lapDist) / Number(trackLength)) % 1 + 1) % 1;
  if (!Number.isFinite(nowFrac)) return [];
  return pitOutTargets({ curve, nb, entryFrac: pitFr.entry, exitFrac: pitFr.exit,
    nowFrac, lapSec, ...opt })
    .map((tg) => ({ ...tg, bin: Math.floor(tg.distFrac * nb) % nb }));
}
