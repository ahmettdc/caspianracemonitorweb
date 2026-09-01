/* ============================================================
   TUR BAŞI AŞINMA — saf modül (v2.3.1)
   ------------------------------------------------------------
   NEDEN: Lastik sekmesi bugün aşınmayı yalnız ANLIK okuyor. `measuredWear`
   (tyrePlanCalc.js) tek bir sayı üretiyor ve bunu iki yerden kısıtlıyor:
     1) dört köşeyi `Math.min(...)` ile "en kötü köşe"ye indiriyor → asimetrik
        aşınma (ör. sağ virajı bol pistte ön-sol) hiç görünmüyor,
     2) hızı (1 − diş) / geçen tur ile STINT ORTALAMASI olarak çıkarıyor →
        degradasyonun HIZLANIP hızlanmadığı okunamıyor.
   Oysa köprü her turun dişini dört köşe ayrı yazıyor (livewear düğümü). Bu modül
   o seriden GERÇEK tur başı aşınmayı çıkarır: köşe başına, ortalama + son pencere.

   ---- SEGMENT SINIRI VERİDEN OKUNUR (uydurma yok) ----
   Lastik değişimi diş oranını YÜKSELTİR. İki turun farkı bir değişimin üstünden
   alınırsa aşınma NEGATİF çıkar ve hesap çöper. Sınırı `livetyre`den (pit kaydı)
   türetmek CAZİP ama YANLIŞ olurdu: o düğüm yalnız "kaç lastik" tutar, HANGİ KÖŞE
   olduğunu tutmaz (bkz. harvest.py: "{adet}|{hamur}"). Yani 2-lastik değişiminde
   hangi iki köşenin sıfırlandığı oradan BİLİNEMEZ.
   Bu yüzden sınır doğrudan ölçümden okunur: bir köşenin dişi arttıysa O KÖŞE
   değişmiştir. Bu gerçek bir okumadır, çıkarım değil — ve 2-lastik değişimini
   kendiliğinden doğru çözer.

   React/Firebase bağımsız → lapWear.test.js doğrudan test eder.
   ============================================================ */

export const CORNERS = ["fl", "fr", "rl", "rr"];

/* Diş oranı gürültüsü: bu kadar ARTIŞ "yeni lastik" sayılır. Köprünün pit
   değişim eşiğiyle (rf2_source.Aggregator.TYRE_JUMP = 0.05) aynı büyüklük
   sınıfında ama daha duyarlı: burada zaten tur-tur örnek var, pit'i ayrıca
   aramıyoruz — yalnız "yukarı sıçrama"yı ayırt etmemiz yeterli. */
export const RESET_EPS = 0.02;

/* Son pencere (tur): degradasyon hızlanıyor mu? Stint ortalaması bunu gizler. */
export const RECENT_LAPS = 5;

/* "0.98,0.97,0.99,0.96" → [0.98,0.97,0.99,0.96]. Bozuk/eksik → null.
   0.0 GEÇERLİ bir diş değeridir (lastik bitmiş) → truthiness ile elenmez. */
export function parseWear(str) {
  const s = String(str == null ? "" : str).trim();
  if (!s) return null;
  const parts = s.split(",");
  if (parts.length !== 4) return null;
  const out = [];
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isFinite(v) || v < 0 || v > 1) return null;
    out.push(v);
  }
  return out;
}

/* {tur: "fl,fr,rl,rr"} → artan tur sırasında [{lap, w:[4]}].
   Bozuk kayıtlar ve geçersiz tur numaraları atlanır (tyreLedger.tyreEvents deseni). */
export function wearSeries(wearLog) {
  if (!wearLog || typeof wearLog !== "object") return [];
  const out = [];
  for (const k of Object.keys(wearLog)) {
    const lap = Number(k);
    if (!Number.isInteger(lap) || lap <= 0) continue;
    const w = parseWear(wearLog[k]);
    if (!w) continue;
    out.push({ lap, w });
  }
  return out.sort((a, b) => a.lap - b.lap);
}

/* Bir köşenin ölçüm noktaları: [{lap, v}] (yalnız geçerli okumalar). */
export function cornerPoints(series, ci) {
  return (Array.isArray(series) ? series : [])
    .filter((s) => Array.isArray(s.w) && Number.isFinite(s.w[ci]))
    .map((s) => ({ lap: s.lap, v: s.w[ci] }));
}

/* Bir köşenin LASTİK DÖNEMLERİ: diş artışı (> RESET_EPS) yeni dönem açar.
   Dönüş: [[{lap,v}, …], …] — en sondaki dönem "şu anki lastik". */
export function cornerSegments(series, ci) {
  const pts = cornerPoints(series, ci);
  if (!pts.length) return [];
  const segs = [];
  let cur = [pts[0]];
  for (let i = 1; i < pts.length; i += 1) {
    if (pts[i].v - pts[i - 1].v > RESET_EPS) { segs.push(cur); cur = [pts[i]]; }
    else cur.push(pts[i]);
  }
  segs.push(cur);
  return segs;
}

/* İki nokta arasındaki tur başı aşınma. Tur NUMARASI kullanılır (örnek sayısı
   değil) → seride boşluk varsa hız bozulmaz. Aşınma yoksa/negatifse null. */
function rateBetween(a, b) {
  const dl = b.lap - a.lap;
  if (!(dl >= 1)) return null;            // tek turluk veri hız vermez
  const drop = a.v - b.v;
  const perLap = drop / dl;
  if (!(perLap > 0)) return null;         // hiç aşınma okunmadı → uydurma yok
  return { perLap, laps: dl };
}

/* Bir köşenin ŞU ANKİ lastiğinin aşınma hızı.
   Dönüş: { perLap, laps, tread, fromLap, toLap, samples, recent } | null
     perLap : dönem ORTALAMASI (tur başı diş kaybı, 0..1)
     recent : son RECENT_LAPS turdaki hız — ortalamadan büyükse degradasyon
              hızlanıyor demektir. Yeterli örnek yoksa null (tahmin üretilmez).
     tread  : son okunan diş */
export function cornerRate(series, ci) {
  const segs = cornerSegments(series, ci);
  if (!segs.length) return null;
  const seg = segs[segs.length - 1];
  if (seg.length < 2) return null;        // yeni takılmış lastik → hız yok
  const first = seg[0];
  const last = seg[seg.length - 1];
  const avg = rateBetween(first, last);
  if (!avg) return null;

  /* Son pencere: toLap − RECENT_LAPS turundan sonraki ilk noktayı taban al.
     Yalnız pencere dönemden GERÇEKTEN kısaysa anlamlıdır (taban ilk nokta ise
     "son hız" ortalamanın aynısı olur, bilgi taşımaz) → o durumda null. */
  let recent = null;
  const cut = last.lap - RECENT_LAPS;
  const base = seg.find((p) => p.lap >= cut && p.lap < last.lap);
  if (base && base.lap > first.lap) {
    const rr = rateBetween(base, last);
    recent = rr ? rr.perLap : null;
  }

  return {
    perLap: avg.perLap,
    laps: avg.laps,
    tread: last.v,
    fromLap: first.lap,
    toLap: last.lap,
    samples: seg.length,
    recent,
  };
}

/* Dört köşe için hız tablosu: [{corner, ...cornerRate} | null] (fl,fr,rl,rr sırası). */
export function wearRates(series) {
  return CORNERS.map((corner, ci) => {
    const r = cornerRate(series, ci);
    return r ? { corner, ...r } : { corner, perLap: null };
  });
}

/* Number(null) === 0 TUZAĞI (bu kod tabanının tekrar eden hatası — CLAUDE.md §1,
   v2.3.0'da lapDist'te yaşandı): eksik diş `Number(null)` ile 0'a çöker, "0 tur
   kaldı" MAKUL görünür ama uydurmadır ve pit duvarına yanlışlıkla "hemen gir"
   dedirtir. Yokluk sayıya çevrilmeden ELENİR. */
const num = (v) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* Diş `floor` seviyesine inene kadar kaç tur kaldı. perLap yoksa null.
   floor: kullanılabilir kabul edilen alt diş sınırı (0 = tamamen bitik). */
export function lapsLeft(tread, perLap, floor = 0) {
  const t = num(tread);
  const r = num(perLap);
  if (t == null || r == null || !(r > 0)) return null;
  const fl = num(floor) ?? 0;
  const left = (t - fl) / r;
  return left > 0 ? left : 0;
}

/* Sahanın özeti: EN KRİTİK köşe (en az turu kalan) — pit penceresini o belirler.
   Dönüş: { corner, perLap, recent, tread, laps } | null */
export function limitingCorner(series, floor = 0) {
  let best = null;
  CORNERS.forEach((corner, ci) => {
    const r = cornerRate(series, ci);
    if (!r) return;
    const left = lapsLeft(r.tread, r.perLap, floor);
    if (left == null) return;
    if (!best || left < best.left) best = { corner, left, ...r };
  });
  return best;
}
