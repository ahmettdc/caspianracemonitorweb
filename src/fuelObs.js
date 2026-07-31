/* ============================================================
   Canlı yakıt öğrenici — SAF mantık (React/Firebase'siz, test edilebilir)
   ------------------------------------------------------------
   Kendi aracın canlı yakıtından litre/tur öğrenir → yakıt/VE modeline öneri
   (FuelTab "⚡ Canlıdan Öğren" + OwnCar "~N tur kaldı").

   ÖNEMLİ (düzeltilen hata): tüketim TUR SINIRINDA mandallanan yakıttan ölçülür.
   Eskiden `prevFuel` HER KAREDE (0.4 sn'de bir) güncelleniyordu; tur tamamlandığı
   karede ölçülen delta bir turun değil ~0.4 saniyenin yakıtı oluyordu (~0.01 L) ve
   makuliyet filtresi (>0.2 L) bunu her seferinde eliyordu → öğrenici HİÇ örnek
   toplayamıyordu (özellik sessizce ölüydü). Artık tur başındaki yakıt `lapFuel`'de
   tutulur ve tur tamamlanınca `lapFuel − fuel` gerçek tur tüketimini verir.
   ============================================================ */

/* Makuliyet filtresi: pit dolumu (yakıt ARTAR → negatif) ve anomaliler elenir. */
const MIN_PER_LAP = 0.2;    // L/tur — bundan azı ölçüm gürültüsü
const MAX_PER_LAP = 30;     // L/tur — bundan fazlası anomali
const BUF_MAX = 6;          // son N tur (medyan alınır)

/* Öğrenici durumunun sıfır hali. */
export const newFuelObs = () => ({ prevLap: null, lapFuel: null, buf: [] });

/* Bir canlı kareyi işle (durumu YERİNDE günceller) ve türetilmiş öneriyi döndür.
   ref: newFuelObs() ile üretilen durum · own: canlı kare `own` nesnesi
   fallbackRatio: model fuelRatio (VE %/tur türetmek için; kapasite yoksa)
   Dönüş: {litersPerLap, samples, fuelCap, obsRatio, obsCons} veya veri yoksa null. */
export function fuelObserve(ref, own, fallbackRatio = 0.86) {
  if (!ref || !own || typeof own.fuel !== "number") return null;
  const lap = typeof own.lapsDone === "number" ? own.lapsDone : null;

  if (lap != null && lap !== ref.prevLap) {
    // tur sınırı: önce TAMAMLANAN turun tüketimini ölç, sonra yeni turu mandalla
    if (ref.prevLap != null && lap > ref.prevLap && ref.lapFuel != null) {
      const perLap = (ref.lapFuel - own.fuel) / (lap - ref.prevLap);
      if (perLap > MIN_PER_LAP && perLap < MAX_PER_LAP) {
        ref.buf.push(perLap);
        if (ref.buf.length > BUF_MAX) ref.buf.shift();
      }
    }
    ref.lapFuel = own.fuel;   // yeni turun başlangıç yakıtı
    ref.prevLap = lap;
  } else if (ref.lapFuel == null) {
    ref.lapFuel = own.fuel;   // ilk kare (tur sınırı beklemeden mandalla)
  }

  const cap = own.fuelCapacity > 0 ? own.fuelCapacity : null;
  const buf = ref.buf;
  if (!buf.length && !cap) return null;
  /* Medyan: tek bir trafik/sarı bayrak turu ortalamayı bozar. */
  const sorted = [...buf].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;
  const obsRatio = cap ? +(cap / 100).toFixed(3) : null;
  const ratioForCons = obsRatio || fallbackRatio || 0.86;
  const obsCons = median != null ? +(median / ratioForCons).toFixed(2) : null;
  return {
    litersPerLap: median != null ? +median.toFixed(2) : null,
    samples: buf.length, fuelCap: cap, obsRatio, obsCons,
  };
}
